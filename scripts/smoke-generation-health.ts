// Generation-health alert smoke test (direct invocation).
//
// Proves /api/public/provider-health-check's runHealthCheck() end-to-end
// against the live DB:
//
//   1. ALERT    — inserts synthetic provider_logs error rows for kind "image"
//                 (enough to force >80% error rate in the last hour), runs
//                 runHealthCheck(), asserts generation_health_state.alert_sent_at
//                 is written and the summary reports DOWN.
//   2. RECOVERY — removes the synthetic errors, inserts synthetic ok rows,
//                 runs runHealthCheck() again, asserts recovery_sent_at is
//                 written after alert_sent_at and consecutive_errors resets.
//
// Safety on the LIVE DB:
//   - A `__maintenance__` sentinel row is written first; runHealthCheck()
//     skips regular (cron) runs while the sentinel is fresh, so this smoke and
//     the 15-minute cron never interleave. The script's own calls bypass the
//     lock explicitly. The sentinel expires after 5 minutes if we crash.
//   - The pre-test "image" state row is snapshotted and restored with a CAS
//     guard on updated_at — if anything else wrote the row mid-run, we leave
//     it alone and report loudly instead of clobbering a legitimate state.
//   - Every state mutation checks its { error } result and fails visibly.
//   - The Resend API is stubbed via a fetch interceptor so NO real operator
//     email is sent; the stub returns ok so the "email sent" persistence path
//     is still exercised.
//
// All synthetic provider_logs rows use provider "smoke-health-test" and are
// deleted at the end.
//
// Run:  bun run scripts/smoke-generation-health.ts

import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { runHealthCheck, MAINTENANCE_KIND } from "../src/routes/api/public/provider-health-check";

const KIND = "image";
const MARKER_PROVIDER = "smoke-health-test";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any;

let resendCalls = 0;
const realFetch = globalThis.fetch;
// Intercept ONLY Resend — everything else (Supabase) passes through.
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("api.resend.com")) {
    resendCalls++;
    console.log(`  [stub] intercepted Resend email #${resendCalls}`);
    return new Response(JSON.stringify({ id: "smoke-stub" }), { status: 200 });
  }
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;

let exitCode = 0;
function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  exitCode = 1;
  throw new Error(msg);
}

function isoMinutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

async function insertLogs(status: "ok" | "error", count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({
    provider: MARKER_PROVIDER,
    endpoint: "smoke",
    kind: KIND,
    status,
    latency_ms: 1,
    cost_usd: 0,
    error: status === "error" ? "synthetic smoke failure" : null,
    created_at: isoMinutesAgo(2 + (i % 30)), // spread within the last hour
  }));
  const { error } = await db.from("provider_logs").insert(rows);
  if (error) fail(`inserting synthetic ${status} logs: ${error.message}`);
}

async function recentCounts(): Promise<{ total: number; errors: number }> {
  const cutoff = isoMinutesAgo(60);
  const { data, error } = await db
    .from("provider_logs")
    .select("status")
    .eq("kind", KIND)
    .gte("created_at", cutoff);
  if (error) fail(`reading provider_logs: ${error.message}`);
  const total = (data ?? []).length;
  const errors = (data ?? []).filter((r: { status: string }) => r.status !== "ok").length;
  return { total, errors };
}

async function getState(kind: string = KIND) {
  const { data, error } = await db
    .from("generation_health_state")
    .select("*")
    .eq("kind", kind)
    .maybeSingle();
  if (error) fail(`reading generation_health_state: ${error.message}`);
  return data;
}

async function acquireMaintenanceLock() {
  const existing = await getState(MAINTENANCE_KIND);
  if (existing && Date.now() - new Date(existing.updated_at).getTime() < 5 * 60_000) {
    fail("another smoke run holds the maintenance lock — try again in 5 minutes");
  }
  const { error } = await db.from("generation_health_state").upsert(
    { kind: MAINTENANCE_KIND, updated_at: new Date().toISOString() },
    { onConflict: "kind" },
  );
  if (error) fail(`acquiring maintenance lock: ${error.message}`);
  console.log("  maintenance lock acquired (cron health checks will skip)");
}

async function releaseMaintenanceLock() {
  const { error } = await db
    .from("generation_health_state")
    .delete()
    .eq("kind", MAINTENANCE_KIND);
  if (error) console.error(`  WARNING: failed to release maintenance lock: ${error.message} (expires in 5 min)`);
  else console.log("  maintenance lock released");
}

async function main() {
  console.log("── generation-health smoke ──");

  await acquireMaintenanceLock();

  // Snapshot + neutralize current state so cooldown/wasAlerting can't skew the test.
  const snapshot = await getState();
  console.log("  snapshot:", snapshot ? JSON.stringify(snapshot) : "none");
  const neutralIso = new Date().toISOString();
  const { error: neutralizeError } = await db.from("generation_health_state").upsert(
    {
      kind: KIND,
      consecutive_ok: 1,
      consecutive_errors: 0,
      last_ok_at: neutralIso,
      alert_sent_at: null,
      recovery_sent_at: null,
      last_error_summary: null,
      last_check_at: null,
      updated_at: neutralIso,
    },
    { onConflict: "kind" },
  );
  if (neutralizeError) {
    await releaseMaintenanceLock();
    fail(`neutralizing image state: ${neutralizeError.message}`);
  }

  // updated_at of the last write WE are responsible for — used as a CAS guard
  // during cleanup so we never clobber a row someone else touched mid-run.
  let lastOwnWriteIso = neutralIso;

  try {
    // ── 1. ALERT ─────────────────────────────────────────────────────────
    // Force >80% error rate in the recent window regardless of real traffic.
    const before = await recentCounts();
    const oks = before.total - before.errors;
    const needed = Math.max(10, Math.ceil(oks * 5)); // errors/(errors+oks) > 0.8
    console.log(`  recent real traffic: ${before.total} rows (${oks} ok) → inserting ${needed} synthetic errors`);
    await insertLogs("error", needed);

    const r1 = (await runHealthCheck({ bypassMaintenanceLock: true })) as {
      ok: boolean; summary: Record<string, string>; alerts_sent: string[]; checked_at: string;
    };
    console.log("  run #1:", JSON.stringify({ ok: r1.ok, image: r1.summary?.[KIND], alerts: r1.alerts_sent }));
    if (!r1.ok) fail("runHealthCheck #1 returned ok=false");
    if (!r1.summary[KIND]?.startsWith("DOWN")) fail(`expected image DOWN, got "${r1.summary[KIND]}"`);
    if (!r1.alerts_sent.includes(KIND)) fail("alert was not sent for image");
    if (resendCalls < 1) fail("Resend stub was never called for the alert");

    const s1 = await getState();
    if (!s1?.alert_sent_at) fail("alert_sent_at was not persisted");
    if (!(s1.consecutive_errors > 0)) fail("consecutive_errors did not increment");
    if (!s1.last_error_summary) fail("last_error_summary was not persisted");
    lastOwnWriteIso = s1.updated_at;
    console.log(`  ✓ alert persisted (alert_sent_at=${s1.alert_sent_at}, consecutive_errors=${s1.consecutive_errors})`);

    // ── 2. RECOVERY ──────────────────────────────────────────────────────
    // Remove synthetic errors and add successes so the kind reads healthy.
    const { error: delErr } = await db.from("provider_logs").delete().eq("provider", MARKER_PROVIDER);
    if (delErr) fail(`removing synthetic error logs: ${delErr.message}`);
    await insertLogs("ok", 12);
    const after = await recentCounts();
    if (after.errors / Math.max(1, after.total) > 0.8) {
      fail(`real traffic is itself >80% errors right now (${after.errors}/${after.total}) — cannot prove recovery; re-run later`);
    }

    const r2 = (await runHealthCheck({ bypassMaintenanceLock: true })) as {
      ok: boolean; summary: Record<string, string>; recoveries_sent: string[];
    };
    console.log("  run #2:", JSON.stringify({ ok: r2.ok, image: r2.summary?.[KIND], recoveries: r2.recoveries_sent }));
    if (!r2.ok) fail("runHealthCheck #2 returned ok=false");
    if (!r2.recoveries_sent.includes(KIND)) fail("recovery was not sent for image");
    if (resendCalls < 2) fail("Resend stub was not called for the recovery email");

    const s2 = await getState();
    if (!s2?.recovery_sent_at) fail("recovery_sent_at was not persisted");
    if (new Date(s2.recovery_sent_at).getTime() <= new Date(s2.alert_sent_at).getTime()) {
      fail("recovery_sent_at is not after alert_sent_at — UI would still show ALERTING");
    }
    if (s2.consecutive_errors !== 0) fail(`consecutive_errors did not reset (got ${s2.consecutive_errors})`);
    lastOwnWriteIso = s2.updated_at;
    console.log(`  ✓ recovery persisted (recovery_sent_at=${s2.recovery_sent_at}, consecutive_errors=0)`);

    console.log(`PASS — alert + recovery both fired and persisted (${resendCalls} stubbed emails, 0 real)`);
  } finally {
    // ── Cleanup ────────────────────────────────────────────────────────────
    const { error: logCleanupErr } = await db
      .from("provider_logs")
      .delete()
      .eq("provider", MARKER_PROVIDER);
    if (logCleanupErr) {
      console.error(`  WARNING: failed to delete synthetic provider_logs: ${logCleanupErr.message}`);
      exitCode = 1;
    }

    // CAS-guarded restore: only touch the row if updated_at still matches the
    // last write we made. If someone else wrote it mid-run, leave it alone.
    if (snapshot) {
      const { data: restored, error: restoreErr } = await db
        .from("generation_health_state")
        .update({ ...snapshot })
        .eq("kind", KIND)
        .eq("updated_at", lastOwnWriteIso)
        .select("kind");
      if (restoreErr) {
        console.error(`  ERROR: failed to restore image state: ${restoreErr.message} — restore manually from snapshot above`);
        exitCode = 1;
      } else if (!restored || restored.length === 0) {
        console.error("  WARNING: image state changed after our last write — NOT restoring snapshot (left as-is). Snapshot printed above for manual review.");
      } else {
        console.log("  image state restored from snapshot");
      }
    } else {
      const { data: deleted, error: deleteErr } = await db
        .from("generation_health_state")
        .delete()
        .eq("kind", KIND)
        .eq("updated_at", lastOwnWriteIso)
        .select("kind");
      if (deleteErr) {
        console.error(`  ERROR: failed to delete smoke-created image state row: ${deleteErr.message}`);
        exitCode = 1;
      } else if (!deleted || deleted.length === 0) {
        console.error("  WARNING: image state changed after our last write — NOT deleting (left as-is).");
      } else {
        console.log("  smoke-created image state row deleted");
      }
    }

    await releaseMaintenanceLock();
  }
}

main().then(
  () => process.exit(exitCode),
  (e) => {
    if (exitCode === 0) console.error(`FAIL: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
