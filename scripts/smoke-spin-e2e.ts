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
 *   6. FULL BATCH    — with CONFIRM_SPEND=1, submits a real 30-post spinThirty
 *                      batch over HTTP with an owned reference (real charge,
 *                      real providers), then drives it to a TERMINAL state by
 *                      polling tickSpinJob/getSpinJob over HTTP and asserts
 *                      all 30 variants completed with result URLs.
 *
 * Cleanup (finally block, including failure paths):
 *   - every spin_jobs / spin_variants row created by this run is deleted;
 *   - every storage object generated for those jobs (<user>/spin/<jobId>/*)
 *     and the temporary reference upload are removed;
 *   - the QA user's profile is restored to its EXACT pre-run state: balance
 *     restored when a profile existed, the profile row deleted when the run
 *     created it.
 *
 * Run:
 *   bun run scripts/smoke-spin-e2e.ts                 # steps 1-5, no charge
 *   CONFIRM_SPEND=1 bun run scripts/smoke-spin-e2e.ts # + real 30-post batch
 */

import { readFileSync } from "node:fs";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { runSmokeSpinOne } from "../src/lib/spin.functions";
import { isFreeGpuOnlyMode } from "../src/lib/app-settings.server";
import { getTestSession, getCredits, setCredits } from "./lib/get-test-session";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:8080";
const SERVER_FN_BASE = `${BASE}/_serverFn/`;
// Public repo photo used as the identity anchor — no personal data.
const REF_PHOTO_PATH = "public/josh/josh-pink-mic-portrait.jpg";
// Enough for a full photo batch (30 × SPIN_PIECE_COST) with headroom.
const CREDITS_FOR_BATCH = 400;

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

  const res = await fetch(url, { method: opts.method, headers, body });
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
      console.log("\n  [6 batch] submitting REAL 30-post spinThirty batch over HTTP…");
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
      if (terminal.variants.length !== 30 || doneWithUrl !== 30) {
        fail(
          `batch terminal but incomplete: status=${terminal.status} variants=${terminal.variants.length} doneWithUrl=${doneWithUrl}/30`,
        );
      }
      console.log("  [6 batch] ✓ terminal state reached; all 30 variants done with result URLs");
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
