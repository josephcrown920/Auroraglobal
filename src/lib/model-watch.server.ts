/**
 * Model Watch — automatic discovery of newly released AI models.
 *
 * Called by the cron daemon every 6 h via /api/public/model-watch (and on
 * demand from the admin panel). Three sources:
 *
 *   1. fal.ai public catalog  — keyword searches over their models API;
 *      any model id we have never seen before is recorded.
 *   2. Replicate collections  — curated lists (text-to-video, …) fetched
 *      with the account token; new entries recorded the same way.
 *   3. ModelArk "anticipated" slugs — specific ByteDance model ids we are
 *      waiting on (e.g. Seedance 2.5). Probed with an intentionally invalid
 *      payload (`content: []`) which can NEVER enqueue a billable task; the
 *      error code tells us whether the account can call the model yet
 *      (ModelNotOpen → not activated, InvalidParameter/2xx → callable).
 *
 * First run per provider seeds a baseline silently (status 'seeded', no
 * email). After that, genuinely new rows are inserted status 'new' and the
 * operator gets one Resend email per scan listing them. An anticipated slug
 * transitioning to 'open' also triggers the email. Provider failures are
 * reported explicitly in the scan result — never swallowed.
 *
 * Concurrency: cron and the admin "Scan now" button can overlap. Safe with
 * no lock — catalog rows go in via ON CONFLICT DO NOTHING and only the rows
 * THIS scan actually inserted get emailed, and availability transitions CAS
 * on the prior value so exactly one scan records (and emails) a flip.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getBytePlusKey, bytePlusBaseUrl } from "@/lib/byteplus.server";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ArkAvailability = "open" | "not_open" | "not_found" | "error";

// Flat JSON primitives only — this type crosses the server-fn wire, and the
// TanStack Start serialization validator rejects `unknown` members.
export type ModelWatchMeta = Record<string, string | number | boolean | null>;

export type CatalogEntry = {
  provider: "fal" | "replicate";
  model_id: string;
  title: string | null;
  category: string | null;
  meta: ModelWatchMeta;
};

export type ModelWatchRow = {
  id: string;
  provider: string;
  model_id: string;
  title: string | null;
  category: string | null;
  watch_kind: "catalog" | "anticipated";
  availability: string | null;
  status: "seeded" | "new" | "reviewed" | "ignored";
  meta: ModelWatchMeta;
  first_seen: string;
  last_checked: string;
};

export type ArkTransition = {
  model_id: string;
  title: string;
  from: string | null;
  to: ArkAvailability;
};

export type ModelWatchScanResult = {
  ok: boolean;
  scanned: { fal: number; replicate: number; modelark: number };
  seeded: number;
  new_models: { provider: string; model_id: string; title: string | null }[];
  transitions: ArkTransition[];
  email_sent: boolean;
  provider_errors: Record<string, string>;
};

// ─── ModelArk anticipated slugs ──────────────────────────────────────────────
// Slugs we are actively waiting on. `auroraKey` is the Aurora model value
// already wired to that slug in BYTEPLUS_DEFAULTS (orchestrator.server.ts) —
// when a probe flips to "open", flipping that model's `status` in models.ts
// to "live" is the only remaining step.

export const ARK_ANTICIPATED: { modelId: string; title: string; auroraKey: string }[] = [
  { modelId: "dreamina-seedance-2-5-260628", title: "Seedance 2.5", auroraKey: "seedance-2.5" },
  { modelId: "seedance-1-5-pro-251215", title: "Seedance 1.5 Pro", auroraKey: "seedance-3.0" },
  // 2026-08-10: retargeted from the legacy seedance-1-0-pro(-fast) slugs to the
  // dreamina 2.0 checkpoints BYTEPLUS_DEFAULTS actually dispatches — an
  // "activated" flip must mean the slug THE APP CALLS is serviceable. (The old
  // 1-0-pro slugs still exist on ModelArk, also ModelNotOpen, but activating
  // them wouldn't help Aurora.)
  { modelId: "dreamina-seedance-2-0-260128", title: "Seedance 2.0", auroraKey: "seedance-2.0" },
  { modelId: "dreamina-seedance-2-0-fast-260128", title: "Seedance 2.0 Fast", auroraKey: "seedance-2.0-fast" },
  // ByteDance campaign (2026-08-07 14:00 → 2026-09-07 14:00): "Seedance 2.0
  // mini" billed at 40% of list (~$0.03/s @720p promo, ~$0.075/s full) and
  // "Seedance 2.0 Lite" at 75% (~$0.089/s promo, ~$0.119/s full). Mini is NOT
  // yet in the ap-southeast catalog (2026-08-10 probe: 40 stem/suffix variants
  // all NotFound) — this dated suffix is a best guess following the 2.0 family
  // pattern; the probe alerts if/when it appears. No Aurora key is wired yet
  // (auroraKey is prospective — add BYTEPLUS_DEFAULTS + tiers when it opens).
  { modelId: "dreamina-seedance-2-0-mini-260128", title: "Seedance 2.0 Mini", auroraKey: "seedance-2.0-mini" },
];

// ─── Pure helpers (exported for tests) ───────────────────────────────────────

/**
 * Classify a ModelArk create-task probe response. The probe body is always
 * invalid (`content: []`) so a billable task can never be created; what the
 * error code tells us is whether the MODEL resolved for this account.
 */
export function classifyArkProbe(httpStatus: number, body: unknown): ArkAvailability {
  if (httpStatus >= 200 && httpStatus < 300) return "open"; // should not happen with an invalid payload
  const code =
    body && typeof body === "object"
      ? String((body as { error?: { code?: unknown } }).error?.code ?? "")
      : "";
  if (code === "ModelNotOpen") return "not_open";
  if (code.includes("NotFound")) return "not_found";
  // Param-level rejections mean the model resolved and is callable.
  if (code.includes("InvalidParameter") || code.includes("MissingParameter") || code.includes("InvalidRequest")) {
    return "open";
  }
  return "error";
}

/** Entries whose (provider, model_id) pair is not in `existing`. */
export function diffCatalog(existing: Set<string>, found: CatalogEntry[]): CatalogEntry[] {
  const seen = new Set<string>();
  const out: CatalogEntry[] = [];
  for (const e of found) {
    const key = `${e.provider}:${e.model_id}`;
    if (existing.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

// ─── Provider fetchers ───────────────────────────────────────────────────────

const FAL_QUERIES = ["text-to-video", "image-to-video", "lipsync", "text-to-image"];

async function fetchFalCatalog(): Promise<CatalogEntry[]> {
  const byId = new Map<string, CatalogEntry>();
  for (const q of FAL_QUERIES) {
    const res = await fetch(`https://fal.ai/api/models?keywords=${encodeURIComponent(q)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`fal catalog HTTP ${res.status} (query "${q}")`);
    const json = (await res.json()) as {
      items?: {
        id?: string;
        title?: string;
        category?: string;
        status?: string;
        deprecated?: boolean;
        removed?: boolean;
        publishedAt?: string;
        date?: string;
        modelFamily?: string;
      }[];
    };
    for (const it of json.items ?? []) {
      if (!it.id) continue;
      if (it.status !== "public" || it.deprecated || it.removed) continue;
      byId.set(it.id, {
        provider: "fal",
        model_id: it.id,
        title: it.title ?? null,
        category: it.category ?? null,
        meta: {
          published_at: it.publishedAt ?? it.date ?? null,
          family: it.modelFamily ?? null,
          query: q,
        },
      });
    }
  }
  return [...byId.values()];
}

const REPLICATE_COLLECTIONS = ["text-to-video", "image-to-video", "text-to-image"];

async function fetchReplicateCatalog(): Promise<{ entries: CatalogEntry[]; note?: string }> {
  const token = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
  if (!token) return { entries: [], note: "no Replicate token configured — skipped" };
  const byId = new Map<string, CatalogEntry>();
  const missing: string[] = [];
  for (const slug of REPLICATE_COLLECTIONS) {
    const res = await fetch(`https://api.replicate.com/v1/collections/${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 404) {
      missing.push(slug); // collection slug does not exist — note it, keep going
      continue;
    }
    if (!res.ok) throw new Error(`replicate collection "${slug}" HTTP ${res.status}`);
    const json = (await res.json()) as {
      models?: { owner?: string; name?: string; description?: string; run_count?: number }[];
    };
    for (const m of json.models ?? []) {
      if (!m.owner || !m.name) continue;
      const id = `${m.owner}/${m.name}`;
      byId.set(id, {
        provider: "replicate",
        model_id: id,
        title: m.name,
        category: slug,
        meta: {
          description: (m.description ?? "").slice(0, 200) || null,
          run_count: m.run_count ?? null,
        },
      });
    }
  }
  return {
    entries: [...byId.values()],
    note: missing.length ? `collections not found: ${missing.join(", ")}` : undefined,
  };
}

async function probeArkAnticipated(): Promise<{
  probes: {
    modelId: string;
    title: string;
    auroraKey: string;
    availability: ArkAvailability;
    code: string | null;
    unexpectedTaskId: string | null;
  }[];
  note?: string;
}> {
  const key = getBytePlusKey();
  if (!key) return { probes: [], note: "no BYTEPLUS_API_KEY/ARK_API_KEY — skipped" };
  const base = bytePlusBaseUrl();
  const probes = await Promise.all(
    ARK_ANTICIPATED.map(async (a) => {
      const res = await fetch(`${base}/contents/generations/tasks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        // Deliberately invalid payload — can never enqueue a billable task.
        body: JSON.stringify({ model: a.modelId, content: [] }),
        signal: AbortSignal.timeout(15_000),
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const code =
        body && typeof body === "object"
          ? String((body as { error?: { code?: unknown } }).error?.code ?? "") || null
          : null;

      // Safety net: the payload is invalid, so a 2xx should be impossible —
      // but if ModelArk ever starts accepting `content: []`, a real (billable)
      // task would have been created. Cancel it immediately and log loudly.
      let unexpectedTaskId: string | null = null;
      if (res.ok) {
        unexpectedTaskId =
          body && typeof body === "object"
            ? String((body as { id?: unknown }).id ?? "") || null
            : null;
        console.error(
          `[model-watch] UNEXPECTED 2xx from invalid ModelArk probe (${a.modelId})` +
            (unexpectedTaskId ? ` — cancelling task ${unexpectedTaskId}` : " — no task id in response"),
        );
        if (unexpectedTaskId) {
          try {
            await fetch(`${base}/contents/generations/tasks/${unexpectedTaskId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${key}` },
              signal: AbortSignal.timeout(10_000),
            });
          } catch (cancelErr) {
            console.error(
              `[model-watch] cancel of unexpected probe task ${unexpectedTaskId} failed:`,
              cancelErr instanceof Error ? cancelErr.message : cancelErr,
            );
          }
        }
      }

      return { ...a, availability: classifyArkProbe(res.status, body), code, unexpectedTaskId };
    }),
  );
  return { probes };
}

// ─── Operator email ──────────────────────────────────────────────────────────

async function sendModelWatchEmail(opts: {
  newModels: { provider: string; model_id: string; title: string | null }[];
  opened: ArkTransition[];
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const to = process.env.AURORA_ALERT_EMAIL || "hello@auroraperformancestudio.com";
  const from =
    process.env.AURORA_FROM_EMAIL || "Aurora Model Watch <noreply@auroraperformancestudio.com>";

  const listed = opts.newModels.slice(0, 25);
  const more = opts.newModels.length - listed.length;

  const openedHtml = opts.opened.length
    ? `<h2 style="font-size:15px;color:#a78bfa;margin:0 0 8px">Now callable on ModelArk</h2>
       <ul style="margin:0 0 20px;padding-left:18px;color:#e5e7eb;font-size:13px;line-height:1.7">
       ${opts.opened.map((t) => `<li><strong>${t.title}</strong> (${t.model_id}) — was ${t.from ?? "unknown"}, now <strong style="color:#34d399">${t.to}</strong>. Flip its Aurora model status to "live".</li>`).join("")}
       </ul>`
    : "";

  const newHtml = listed.length
    ? `<h2 style="font-size:15px;color:#a78bfa;margin:0 0 8px">Newly spotted models</h2>
       <ul style="margin:0;padding-left:18px;color:#e5e7eb;font-size:13px;line-height:1.7">
       ${listed.map((m) => `<li><strong>${m.title ?? m.model_id}</strong> — ${m.provider} · <code style="font-size:12px;color:#9ca3af">${m.model_id}</code></li>`).join("")}
       </ul>
       ${more > 0 ? `<p style="color:#6b7280;font-size:12px;margin:8px 0 0">…and ${more} more in the admin panel.</p>` : ""}`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Aurora Model Watch</title></head>
<body style="margin:0;padding:0;background:#080a12;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080a12">
<tr><td align="center" style="padding:40px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:24px;text-align:center">
    <span style="font-size:22px;font-weight:800;color:#a78bfa">Aurora</span><span style="font-size:22px;font-weight:300;color:#6b7280"> Performance Studio</span>
  </td></tr>
  <tr><td style="background:#0f1123;border:1px solid rgba(167,139,250,0.18);border-radius:14px;padding:32px 28px">
    ${openedHtml}
    ${newHtml}
    <p style="color:#6b7280;font-size:12px;margin:20px 0 0">Review in the admin panel → Model Watch.</p>
  </td></tr>
  <tr><td style="padding-top:18px;text-align:center;font-size:11px;color:#374151">
    Aurora Performance Studio &nbsp;·&nbsp; Model Watch
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const subjectBits: string[] = [];
  if (opts.opened.length) subjectBits.push(`${opts.opened.length} now callable`);
  if (opts.newModels.length) subjectBits.push(`${opts.newModels.length} new model(s)`);

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: `Aurora Model Watch — ${subjectBits.join(" · ")}`, html }),
    signal: AbortSignal.timeout(15_000),
  });
  return res.ok;
}

// ─── Scan ────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
const modelWatchTable = () => supabaseAdmin.from("model_watch" as any) as any;

export async function runModelWatchScan(): Promise<ModelWatchScanResult> {
  const providerErrors: Record<string, string> = {};

  const [falRes, repRes, arkRes] = await Promise.allSettled([
    fetchFalCatalog(),
    fetchReplicateCatalog(),
    probeArkAnticipated(),
  ]);

  const falEntries = falRes.status === "fulfilled" ? falRes.value : [];
  if (falRes.status === "rejected") providerErrors.fal = String(falRes.reason?.message ?? falRes.reason);

  const repEntries = repRes.status === "fulfilled" ? repRes.value.entries : [];
  if (repRes.status === "rejected") {
    providerErrors.replicate = String(repRes.reason?.message ?? repRes.reason);
  } else if (repRes.value.note) {
    providerErrors.replicate = repRes.value.note; // informational (skipped / partial)
  }

  const arkProbes = arkRes.status === "fulfilled" ? arkRes.value.probes : [];
  if (arkRes.status === "rejected") {
    providerErrors.modelark = String(arkRes.reason?.message ?? arkRes.reason);
  } else if (arkRes.value.note) {
    providerErrors.modelark = arkRes.value.note;
  }

  // Existing rows (id pairs + availability for transition detection).
  const { data: existingRows, error: exErr } = await modelWatchTable()
    .select("provider, model_id, watch_kind, availability")
    .limit(10_000);
  if (exErr) throw new Error(`model_watch select failed: ${exErr.message}`);

  const existing = new Set<string>(
    (existingRows ?? [])
      .filter((r: { watch_kind: string }) => r.watch_kind === "catalog")
      .map((r: { provider: string; model_id: string }) => `${r.provider}:${r.model_id}`),
  );
  const catalogCountByProvider: Record<string, number> = {};
  for (const r of existingRows ?? []) {
    if (r.watch_kind === "catalog") {
      catalogCountByProvider[r.provider] = (catalogCountByProvider[r.provider] ?? 0) + 1;
    }
  }
  const arkPrior = new Map<string, string | null>(
    (existingRows ?? [])
      .filter((r: { watch_kind: string }) => r.watch_kind === "anticipated")
      .map((r: { model_id: string; availability: string | null }) => [r.model_id, r.availability]),
  );

  // Catalog diff → insert. First scan for a provider seeds silently.
  // ON CONFLICT DO NOTHING + counting only the rows .select() returns makes
  // concurrent scans safe: a row is inserted (and therefore emailed) at most
  // once globally, and the losing scan gets no conflict error.
  const fresh = diffCatalog(existing, [...falEntries, ...repEntries]);
  const now = new Date().toISOString();
  let seeded = 0;
  const newModels: { provider: string; model_id: string; title: string | null }[] = [];
  const toInsert = fresh.map((e) => ({
    provider: e.provider,
    model_id: e.model_id,
    title: e.title,
    category: e.category,
    watch_kind: "catalog",
    status: (catalogCountByProvider[e.provider] ?? 0) === 0 ? "seeded" : "new",
    meta: e.meta,
    first_seen: now,
    last_checked: now,
  }));
  for (let i = 0; i < toInsert.length; i += 500) {
    const { data: inserted, error } = await modelWatchTable()
      .upsert(toInsert.slice(i, i + 500), { onConflict: "provider,model_id", ignoreDuplicates: true })
      .select("provider, model_id, title, status");
    if (error) throw new Error(`model_watch insert failed: ${error.message}`);
    for (const row of inserted ?? []) {
      if (row.status === "seeded") seeded += 1;
      else newModels.push({ provider: row.provider, model_id: row.model_id, title: row.title });
    }
  }

  // Anticipated probes → update/insert + transition detection.
  const transitions: ArkTransition[] = [];
  for (const p of arkProbes) {
    const meta: ModelWatchMeta = { aurora_key: p.auroraKey, code: p.code };
    if (p.unexpectedTaskId) meta.probe_task_id = p.unexpectedTaskId;

    if (arkPrior.has(p.modelId)) {
      const prior = arkPrior.get(p.modelId) ?? null;
      if (prior === p.availability) {
        // No change — just refresh the probe bookkeeping.
        const { error } = await modelWatchTable()
          .update({ last_checked: now, meta })
          .eq("provider", "modelark")
          .eq("model_id", p.modelId);
        if (error) throw new Error(`model_watch update failed: ${error.message}`);
      } else {
        // CAS on the prior value: only the scan that wins this update records
        // (and later emails) the transition — a concurrent scan matches zero
        // rows and stays silent.
        let query = modelWatchTable()
          .update({ availability: p.availability, last_checked: now, meta })
          .eq("provider", "modelark")
          .eq("model_id", p.modelId);
        query = prior === null ? query.is("availability", null) : query.eq("availability", prior);
        const { data: updated, error } = await query.select("model_id");
        if (error) throw new Error(`model_watch update failed: ${error.message}`);
        if ((updated ?? []).length > 0) {
          transitions.push({ model_id: p.modelId, title: p.title, from: prior, to: p.availability });
        }
      }
    } else {
      // First sighting — never a transition, so duplicate-insert races are
      // harmless (ignoreDuplicates keeps the loser error-free).
      const { error } = await modelWatchTable().upsert(
        {
          provider: "modelark",
          model_id: p.modelId,
          title: p.title,
          category: "video",
          watch_kind: "anticipated",
          availability: p.availability,
          status: "seeded",
          meta,
          first_seen: now,
          last_checked: now,
        },
        { onConflict: "provider,model_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(`model_watch insert failed: ${error.message}`);
    }
  }

  // Email only when there is genuine news.
  const opened = transitions.filter((t) => t.to === "open");
  let emailSent = false;
  if (newModels.length > 0 || opened.length > 0) {
    try {
      emailSent = await sendModelWatchEmail({ newModels, opened });
    } catch (err) {
      providerErrors.email = String(err instanceof Error ? err.message : err);
    }
  }

  return {
    ok: true,
    scanned: { fal: falEntries.length, replicate: repEntries.length, modelark: arkProbes.length },
    seeded,
    new_models: newModels,
    transitions,
    email_sent: emailSent,
    provider_errors: providerErrors,
  };
}
