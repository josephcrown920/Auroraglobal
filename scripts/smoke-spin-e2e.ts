/**
 * TikTok Spin end-to-end smoke test — REAL wire-format, REAL middleware.
 *
 * Unlike the direct-invocation smokes, this script calls the running dev
 * server's server-function HTTP endpoints using TanStack Start's own client
 * fetcher (`serverFnFetcher`) — the byte-identical wire format a browser tab
 * sends. That exercises the full production stack:
 *
 *   requireSupabaseAuth middleware → inputValidator (zod) →
 *   assertOwnedReferenceImage → credit charge → batch creation
 *
 * Steps:
 *   1. SESSION       — passwordless QA session via admin generateLink +
 *                      verifyOtp (see scripts/lib/get-test-session.ts).
 *   2. AUTH-NEGATIVE — getSpinOptions over HTTP with NO auth header must be
 *                      rejected by requireSupabaseAuth.
 *   3. AUTH-POSITIVE — getSpinOptions over HTTP with the QA bearer token must
 *                      succeed through the same middleware.
 *   4. OWNERSHIP     — spinThirty over HTTP with a NOT-owned reference URL
 *                      must be rejected by assertOwnedReferenceImage BEFORE
 *                      any credits are charged (balance asserted unchanged).
 *   5. RENDER        — one real render through runSmokeSpinOne (direct
 *                      invocation; documented as a lower-level check, it does
 *                      NOT cover auth/billing — steps 2-4 do).
 *   6. FULL BATCH    — with CONFIRM_SPEND=1, submits a real SPIN_COUNT-post
 *                      spinThirty batch over HTTP with an owned reference
 *                      (real charge, real providers; the QA user's admin role
 *                      is dropped for the run so the charge is real), then
 *                      drives it to a TERMINAL state by polling
 *                      tickSpinJob/getSpinJob over HTTP and asserts every
 *                      variant completed with a result URL.
 *   7. IDENTITY      — STRICT evidence per variant: exactly one successful
 *                      provider_logs record from an identity-capable provider
 *                      (query errors / missing / ambiguous / unknown provider
 *                      all fail), and every result image must download
 *                      non-empty to /tmp/spin-e2e-images for visual face
 *                      comparison before cleanup deletes the originals.
 *
 * Cleanup (finally block, including failure paths):
 *   - every spin_jobs / spin_variants row created by this run is deleted;
 *   - every storage object generated for those jobs (<user>/spin/<jobId>/*)
 *     and the temporary reference upload are removed;
 *   - the QA user's admin role (if dropped) is restored;
 *   - the QA user's profile is restored to its EXACT pre-run state: balance
 *     restored when a profile existed, the profile row deleted when the run
 *     created it.
 *
 * Run:
 *   bun run scripts/smoke-spin-e2e.ts                 # steps 1-5, no charge
 *   CONFIRM_SPEND=1 bun run scripts/smoke-spin-e2e.ts # + real full batch
 */

import { readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { runSmokeSpinOne } from "../src/lib/spin.functions";
import { isFreeGpuOnlyMode } from "../src/lib/app-settings.server";
import { SPIN_COUNT, spinTotalCost } from "../src/lib/spin-engine";
import { FAL_IDENTITY_EDITS, GEMINI_DIRECT_SLUGS } from "../src/lib/orchestrator.server";
import { getTestSession, getCredits, setCredits } from "./lib/get-test-session";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:8080";
const SERVER_FN_BASE = `${BASE}/_serverFn/`;
// Public repo photo used as the identity anchor — no personal data.
const REF_PHOTO_PATH = "public/josh/josh-pink-mic-portrait.jpg";
// Enough for a full photo batch (SPIN_COUNT × SPIN_PIECE_COST) with headroom —
// derived from the real pricing engine so a SPIN_COUNT or cost bump can never
// silently underfund the smoke batch again.
const CREDITS_FOR_BATCH = spinTotalCost(SPIN_COUNT, 0) + 100;

// Identity-edit evidence is validated at the ENDPOINT level, not just the
// provider name — a provider like "replicate" serves both edit-capable
// (nano-banana image_input) and text-to-image (seedream) models, so the
// provider name alone can't prove the face reference was honored. The
// endpoint strings each adapter logs are:
//   replit-gemini-image:<model>   Replit Gemini proxy — inlines refs as inline_data
//   gemini:<model>                own-key Gemini — inline_data refs
//   fal:<path>/edit               fal identity-edit endpoints (image_urls[])
//   replicate:google/nano-banana* image_input-driven Replicate models
// Derived from the router's own routing maps so a route change breaks the
// smoke loudly instead of silently loosening the check.
function isIdentityEditEndpoint(provider: string, endpoint: string): boolean {
  switch (provider) {
    case "replit-gemini-image":
      return endpoint.startsWith("replit-gemini-image:gemini-");
    case "gemini":
      return endpoint.startsWith("gemini:gemini-") && Object.values(GEMINI_DIRECT_SLUGS).some((m) => endpoint === `gemini:${m}`);
    case "fal":
      return Object.values(FAL_IDENTITY_EDITS).some((p) => endpoint === `fal:${p}`);
    case "replicate":
      return endpoint === "replicate:google/nano-banana" || endpoint === "replicate:google/nano-banana-pro";
    default:
      return false;
  }
}

function fail(msg: string): never {
  throw new Error(msg);
}

// ─── Server-fn wire helpers ──────────────────────────────────────────────────

/**
 * Discovers the server-function RPC ids for src/lib/spin.functions.ts by
 * asking the running dev server for the client-transformed module — the same
 * ids the browser bundle uses. Ids are build artifacts, so we never hardcode.
 */
async function discoverSpinFnIds(): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}/src/lib/spin.functions.ts`);
  if (!res.ok) fail(`dev server module fetch failed: ${res.status} — is the app running?`);
  const src = await res.text();
  const ids: Record<string, string> = {};
  for (const m of src.matchAll(/createClientRpc\("([^"]+)"\)/g)) {
    const decoded = JSON.parse(Buffer.from(m[1]!, "base64").toString("utf8")) as {
      export: string;
    };
    const name = decoded.export.replace(/_createServerFn_handler$/, "");
    ids[name] = m[1]!;
  }
  for (const required of ["getSpinOptions", "spinThirty", "tickSpinJob", "getSpinJob"]) {
    if (!ids[required]) fail(`could not discover RPC id for ${required}`);
  }
  return ids;
}

/**
 * Calls a server function over HTTP exactly as the browser does — via
 * TanStack Start's own client fetcher (identical headers, payload encoding,
 * and framed-response decoding).
 */
async function callServerFn(
  fnId: string,
  opts: { method: "GET" | "POST"; data?: unknown; accessToken?: string },
): Promise<unknown> {
  // Same wire format serverFnFetcher produces (headers, seroval payload
  // encoding, crossjson response decoding) — reimplemented here because the
  // packaged fetcher requires the browser Start runtime context.
  const seroval = await import("seroval");
  const { defaultSerovalPlugins } = await import("@tanstack/router-core");
  const headers: Record<string, string> = {
    "x-tsr-serverFn": "true",
    accept: "application/json",
  };
  if (opts.accessToken) headers["Authorization"] = `Bearer ${opts.accessToken}`;

  let url = SERVER_FN_BASE + fnId;
  let body: string | undefined;
  if (opts.data !== undefined) {
    const serialized = JSON.stringify(
      await seroval.toJSONAsync({ data: opts.data }, { plugins: defaultSerovalPlugins }),
    );
    if (opts.method === "GET") {
      url += `?payload=${encodeURIComponent(serialized)}`;
    } else {
      body = serialized;
      headers["content-type"] = "application/json";
    }
  }

  // Bounded: a dev-server request that never returns must surface as an
  // error (retried by the poll loop) rather than hanging the smoke forever —
  // a real run once stalled indefinitely on a single getSpinJob fetch while
  // the batch itself finished fine in the background.
  const res = await fetch(url, {
    method: opts.method,
    headers,
    body,
    signal: AbortSignal.timeout(120_000),
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    fail(`unexpected server-fn response: ${res.status} ${contentType}`);
  }
  const payload = (await res.json()) as Parameters<typeof seroval.fromCrossJSON>[0];
  const decoded = seroval.fromCrossJSON(payload, {
    refs: new Map(),
    plugins: defaultSerovalPlugins,
  }) as {
    result?: unknown;
    error?: unknown;
  };
  if (decoded.error !== undefined && decoded.error !== null) {
    const err = decoded.error;
    throw err instanceof Error
      ? err
      : new Error(typeof err === "object" ? JSON.stringify(err) : String(err));
  }
  return decoded.result;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("── spin e2e smoke (real HTTP wire format) ──");

  // ── Preflight ────────────────────────────────────────────────────────────
  const freeOnly = await isFreeGpuOnlyMode();
  if (freeOnly) {
    fail("Free-GPU-only mode is ON — paid providers blocked pre-dispatch. Turn it off first.");
  }
  const fnIds = await discoverSpinFnIds();
  console.log(`  [preflight] free-GPU-only off; discovered ${Object.keys(fnIds).length} spin RPC ids`);

  // ── 1. Session ───────────────────────────────────────────────────────────
  const { userId, accessToken, session } = await getTestSession();
  if (!session.refresh_token || !session.user) {
    fail("session is missing refresh_token/user — browser setSession would fail");
  }
  console.log(`  [1 session] QA user ${userId}; full session obtained (access+refresh+user) ✓`);

  // Save the EXACT pre-run balance for restoration.
  const originalCredits = await getCredits(userId);
  console.log(`  [1 session] pre-run credit balance: ${originalCredits ?? "no profile row"}`);

  const profileExisted = originalCredits !== null;
  let refPath: string | null = null;
  const createdJobIds: string[] = [];

  // The QA user may carry the admin role (used by other smokes). spinThirty
  // bypasses the credit charge for admins, which would turn the paid-batch
  // assertions of step 6 into no-ops — so drop the role for the duration of
  // the run and restore it in the finally block.
  let removedAdminRole = false;
  {
    const { data: adminRows, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (roleErr) fail(`read user_roles: ${roleErr.message}`);
    if ((adminRows ?? []).length > 0) {
      const { error: delRoleErr } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");
      if (delRoleErr) fail(`remove admin role: ${delRoleErr.message}`);
      removedAdminRole = true;
      console.log("  [1 session] QA user had the admin role — removed for this run (restored at cleanup)");
    }
  }

  try {
    // ── 2. Auth negative: no bearer → middleware must reject ───────────────
    console.log("\n  [2 auth-negative] getSpinOptions over HTTP without auth…");
    let unauthorizedRejected = false;
    try {
      await callServerFn(fnIds.getSpinOptions!, { method: "GET" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/unauthorized/i.test(msg)) unauthorizedRejected = true;
      else fail(`expected Unauthorized, got: ${msg}`);
    }
    if (!unauthorizedRejected) fail("unauthenticated call was NOT rejected by requireSupabaseAuth");
    console.log("  [2 auth-negative] ✓ rejected by requireSupabaseAuth");

    // ── 3. Auth positive: QA bearer → middleware must accept ───────────────
    console.log("  [3 auth-positive] getSpinOptions over HTTP with QA bearer…");
    const options = (await callServerFn(fnIds.getSpinOptions!, {
      method: "GET",
      accessToken,
    })) as { templates?: unknown[] };
    if (!options || !Array.isArray(options.templates) || options.templates.length === 0) {
      fail(`getSpinOptions returned unexpected shape: ${JSON.stringify(options).slice(0, 200)}`);
    }
    console.log(
      `  [3 auth-positive] ✓ authenticated through middleware; ${options.templates.length} templates returned`,
    );

    // ── 4. Ownership: not-owned reference must reject BEFORE any charge ────
    console.log("  [4 ownership] spinThirty over HTTP with a NOT-owned reference URL…");
    const balanceBefore = await getCredits(userId);
    const foreignUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/studio/00000000-0000-0000-0000-000000000000/uploads/not-mine.jpg`;
    let ownershipRejected = false;
    try {
      await callServerFn(fnIds.spinThirty!, {
        method: "POST",
        accessToken,
        data: { faceUrl: foreignUrl, prompt: "smoke-test creator portrait", templateId: "default" },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/only use character images you own/i.test(msg)) ownershipRejected = true;
      else fail(`expected ownership rejection, got: ${msg}`);
    }
    if (!ownershipRejected) fail("spinThirty accepted a reference image the user does not own");
    const balanceAfter = await getCredits(userId);
    if (balanceBefore !== balanceAfter) {
      fail(`ownership rejection charged credits: ${balanceBefore} → ${balanceAfter}`);
    }
    console.log("  [4 ownership] ✓ rejected pre-charge; balance unchanged");

    // ── Upload an owned reference for the render steps ─────────────────────
    const refBytes = readFileSync(REF_PHOTO_PATH);
    refPath = `${userId}/smoke/spin-e2e-ref-${Date.now()}.jpg`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("studio")
      .upload(refPath, refBytes, { contentType: "image/jpeg", upsert: true });
    if (upErr) fail(`studio upload: ${upErr.message}`);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("studio")
      .createSignedUrl(refPath, 3600);
    if (signErr || !signed?.signedUrl) fail(`sign URL: ${signErr?.message ?? "no signedUrl"}`);
    const faceUrl = signed.signedUrl;

    // ── 5. Render path (direct invocation — lower-level check only) ────────
    // NOTE: this bypasses auth/billing on purpose; those are covered by 2-4.
    console.log("  [5 render] one real render via runSmokeSpinOne (direct, no charge)…");
    const piece = await runSmokeSpinOne(userId, faceUrl);
    createdJobIds.push(piece.jobId);
    if (!piece.url?.startsWith("https://") || !piece.provider) {
      fail(`render returned invalid result: ${JSON.stringify(piece)}`);
    }
    console.log(`  [5 render] ✓ provider=${piece.provider} url=${piece.url.slice(0, 80)}…`);

    // ── 6. Full 30-post batch over HTTP (real charge) ──────────────────────
    if (process.env.CONFIRM_SPEND === "1") {
      console.log(`\n  [6 batch] submitting REAL ${SPIN_COUNT}-post spinThirty batch over HTTP…`);
      await setCredits(userId, CREDITS_FOR_BATCH);
      const submitted = (await callServerFn(fnIds.spinThirty!, {
        method: "POST",
        accessToken,
        data: { faceUrl, prompt: "smoke-test creator portrait", templateId: "default" },
      })) as { jobId?: string };
      if (!submitted?.jobId) fail(`spinThirty returned no jobId: ${JSON.stringify(submitted)}`);
      const jobId = submitted.jobId;
      createdJobIds.push(jobId);
      console.log(`  [6 batch] jobId=${jobId} — charged through the real path ✓`);
      const post = await getCredits(userId);
      console.log(`  [6 batch] balance after charge: ${post} (was ${CREDITS_FOR_BATCH})`);
      if (post === CREDITS_FOR_BATCH) fail("batch submission did not charge credits");

      // Drive the job to a terminal state exactly as the browser does: the
      // spin page loops tickSpinJob (renders a small batch per call) and
      // getSpinJob (reads progress). Bearer token is refreshed by re-running
      // the session helper if it expires mid-batch.
      if (!fnIds.tickSpinJob || !fnIds.getSpinJob) {
        fail("could not discover RPC ids for tickSpinJob/getSpinJob — cannot poll batch");
      }
      const deadline = Date.now() + 45 * 60_000;
      let token = accessToken;
      let terminal: { status: string; variants: { status: string; url: string | null }[] } | null =
        null;
      for (;;) {
        if (Date.now() > deadline) fail("batch did not reach a terminal state within 45 minutes");
        try {
          await callServerFn(fnIds.tickSpinJob, {
            method: "POST",
            accessToken: token,
            data: { jobId, batch: 2 },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/unauthorized|jwt|expired/i.test(msg)) {
            token = (await getTestSession()).accessToken;
            continue;
          }
          // A single tick error is not terminal — the job-level status decides.
          console.log(`  [6 batch] tick error (continuing): ${msg.slice(0, 120)}`);
        }
        const snap = (await callServerFn(fnIds.getSpinJob, {
          method: "POST",
          accessToken: token,
          data: { jobId },
        })) as { job: { status: string }; variants: { status: string; url: string | null }[] };
        const done = snap.variants.filter((v) => v.status === "done").length;
        const failed = snap.variants.filter((v) => v.status === "failed").length;
        console.log(
          `  [6 batch] job=${snap.job.status} done=${done} failed=${failed} total=${snap.variants.length}`,
        );
        if (["done", "failed", "partial"].includes(snap.job.status)) {
          terminal = { status: snap.job.status, variants: snap.variants };
          break;
        }
        await new Promise((r) => setTimeout(r, 5_000));
      }
      // Validate the claimed outcome: 30 variants, every one done with a URL.
      const doneWithUrl = terminal.variants.filter(
        (v) => v.status === "done" && !!v.url && v.url.startsWith("https://"),
      ).length;
      if (terminal.variants.length !== SPIN_COUNT || doneWithUrl !== SPIN_COUNT) {
        fail(
          `batch terminal but incomplete: status=${terminal.status} variants=${terminal.variants.length} doneWithUrl=${doneWithUrl}/${SPIN_COUNT}`,
        );
      }
      console.log(`  [6 batch] ✓ terminal state reached; all ${SPIN_COUNT} variants done with result URLs`);

      // ── 7. Identity evidence: providers + local copies ────────────────────
      // (a) Which provider actually served each piece — identity-blind
      //     fallbacks (Pollinations/Runware, or the ComfyUI t2i pool) would
      //     break the same-face guarantee even though the render "succeeded".
      //     provider_logs.ref_id = variant id. This check is STRICT: a query
      //     error, a missing log, an unknown provider, or ambiguous evidence
      //     (≠ exactly one successful record) all FAIL the smoke — absence of
      //     evidence is never treated as proof of identity preservation.
      const { data: variantRows, error: variantErr } = await supabaseAdmin
        .from("spin_variants")
        .select("id,idx,url,status")
        .eq("job_id", jobId)
        .order("idx", { ascending: true });
      if (variantErr) fail(`identity evidence: spin_variants query failed: ${variantErr.message}`);
      if ((variantRows ?? []).length !== SPIN_COUNT) {
        fail(
          `identity evidence: expected ${SPIN_COUNT} variant rows, got ${(variantRows ?? []).length}`,
        );
      }
      const variants = variantRows!;
      const variantIds = variants.map((v) => v.id);
      const { data: plogs, error: plogErr } = await supabaseAdmin
        .from("provider_logs")
        .select("ref_id,provider,endpoint,status,kind")
        .in("ref_id", variantIds);
      if (plogErr) fail(`identity evidence: provider_logs query failed: ${plogErr.message}`);
      const okByVariant = new Map<string, { provider: string; endpoint: string }[]>();
      for (const row of plogs ?? []) {
        if (!row.ref_id || row.status !== "ok") continue;
        const arr = okByVariant.get(row.ref_id) ?? [];
        arr.push({ provider: row.provider, endpoint: row.endpoint });
        okByVariant.set(row.ref_id, arr);
      }
      const bad: string[] = [];
      for (const v of variants) {
        const winners = okByVariant.get(v.id) ?? [];
        if (winners.length === 0) {
          bad.push(`variant ${v.idx}: NO successful provider log`);
          continue;
        }
        if (winners.length > 1) {
          bad.push(
            `variant ${v.idx}: ambiguous — ${winners.length} ok logs (${winners.map((w) => w.endpoint).join(", ")})`,
          );
          continue;
        }
        const winner = winners[0];
        if (!isIdentityEditEndpoint(winner.provider, winner.endpoint)) {
          bad.push(
            `variant ${v.idx}: served by non-identity-edit route "${winner.provider}" endpoint="${winner.endpoint}"`,
          );
          continue;
        }
        console.log(`  [7 identity] variant ${String(v.idx).padStart(2)} endpoint=${winner.endpoint} ✓`);
      }
      if (bad.length > 0) {
        fail(
          `identity evidence FAILED for ${bad.length}/${SPIN_COUNT} variant(s):\n    ${bad.join("\n    ")}`,
        );
      }
      console.log(
        `  [7 identity] ✓ every one of the ${SPIN_COUNT} pieces has exactly one successful log from an identity-edit route`,
      );

      // (b) Download every result locally BEFORE cleanup deletes the storage
      //     objects, so the faces can be visually compared side-by-side.
      //     STRICT: all SPIN_COUNT files must be written or the smoke fails —
      //     the visual-comparison artifact is part of the verification. The
      //     directory is per-run (jobId-suffixed) so stale artifacts from an
      //     earlier run can never be mixed into a review.
      const outDir = `/tmp/spin-e2e-images-${jobId.slice(0, 8)}`;
      rmSync(outDir, { recursive: true, force: true });
      mkdirSync(outDir, { recursive: true });
      let downloaded = 0;
      for (const v of variants) {
        if (!v.url) fail(`identity evidence: variant ${v.idx} has no result URL`);
        const res = await fetch(v.url);
        if (!res.ok) fail(`identity evidence: download failed for variant ${v.idx}: HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength === 0) fail(`identity evidence: variant ${v.idx} downloaded 0 bytes`);
        const ext = (res.headers.get("content-type") ?? "").includes("png") ? "png" : "jpg";
        writeFileSync(`${outDir}/variant-${String(v.idx).padStart(2, "0")}.${ext}`, buf);
        downloaded++;
      }
      if (downloaded !== SPIN_COUNT) {
        fail(`identity evidence: only ${downloaded}/${SPIN_COUNT} result images downloaded`);
      }
      console.log(
        `  [7 identity] ✓ all ${SPIN_COUNT} result images saved to ${outDir} for visual face comparison`,
      );
    } else {
      console.log("\n  (Skipped step 6 real batch — re-run with CONFIRM_SPEND=1 to include it.)");
    }

    console.log(
      "\nPASS — auth (negative+positive), ownership enforcement (pre-charge), and render path verified.",
    );
  } finally {
    // ── Cleanup (runs on success AND failure paths) ─────────────────────────
    // 1. Delete every spin job/variant row this run created, plus every
    //    generated storage object under <user>/spin/<jobId>/.
    for (const jobId of createdJobIds) {
      try {
        const prefix = `${userId}/spin/${jobId}`;
        const { data: objects } = await supabaseAdmin.storage.from("studio").list(prefix, {
          limit: 100,
        });
        const paths = (objects ?? []).map((o) => `${prefix}/${o.name}`);
        if (paths.length) {
          const { error: rmErr } = await supabaseAdmin.storage.from("studio").remove(paths);
          if (rmErr) console.error(`  WARNING: object cleanup failed for job ${jobId}: ${rmErr.message}`);
          else console.log(`  cleanup: removed ${paths.length} generated object(s) for job ${jobId}`);
        }
        const { error: varErr } = await supabaseAdmin
          .from("spin_variants")
          .delete()
          .eq("job_id", jobId);
        if (varErr) console.error(`  WARNING: spin_variants cleanup failed: ${varErr.message}`);
        const { error: jobErr } = await supabaseAdmin.from("spin_jobs").delete().eq("id", jobId);
        if (jobErr) console.error(`  WARNING: spin_jobs cleanup failed: ${jobErr.message}`);
        console.log(`  cleanup: spin job ${jobId} rows deleted`);
      } catch (e) {
        console.error(`  WARNING: cleanup error for job ${jobId}: ${e instanceof Error ? e.message : e}`);
      }
    }
    // 2. Remove the temporary reference upload.
    if (refPath) {
      const { error: delErr } = await supabaseAdmin.storage.from("studio").remove([refPath]);
      if (delErr) console.error(`  WARNING: cleanup failed for ${refPath}: ${delErr.message}`);
      else console.log(`  cleanup: ${refPath} removed`);
    }
    // 3. Restore the profile to its EXACT pre-run state — balance when it
    //    existed, full row deletion when this run created it (setCredits
    //    upserts, so a paid run against a profile-less QA user creates one).
    // 0. Restore the admin role if this run removed it.
    if (removedAdminRole) {
      const { error: roleRestoreErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (roleRestoreErr) console.error(`  WARNING: admin role restore failed: ${roleRestoreErr.message}`);
      else console.log("  cleanup: QA user's admin role restored");
    }
    if (profileExisted) {
      await setCredits(userId, originalCredits!);
      console.log(`  cleanup: credit balance restored to ${originalCredits}`);
    } else {
      const { error: profErr } = await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("user_id", userId);
      if (profErr) console.error(`  WARNING: profile cleanup failed: ${profErr.message}`);
      else console.log("  cleanup: run-created profile row deleted (none existed pre-run)");
    }
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
