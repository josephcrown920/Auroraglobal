/**
 * /api/public/watchdog — the "hound dog".
 *
 * One cron-called sweep (every 5 min from scripts/aurora-cron-daemon.sh) that
 * observes the WHOLE system in a single pass — site probe liveness, scheduler
 * heartbeat, queue distress, GPU workers, provider error-rate monitor,
 * GitHub sync, and the build/restore layer — then:
 *
 *   1. records a verdict per subsystem in `watchdog_state` (atomic upsert via
 *      the watchdog_record_state RPC — concurrent passes can't lose counts),
 *   2. fires safe, idempotent auto-remediations from a conservative allow-list
 *      (tick_rerun / worker_reprobe / github_sync_relaunch), each claimed
 *      atomically with a cooldown and logged to `watchdog_actions` with
 *      before/after state,
 *   3. emails the operator (one alert per outage + recovery) only for what no
 *      dedicated monitor already covers or what it could not fix. Alert and
 *      recovery delivery is claimed atomically via watchdog_claim_transition
 *      BEFORE sending, so overlapping passes can never double-send.
 *
 * All decision rules live in src/lib/watchdog.ts (pure, unit-tested).
 *
 * Auth: server-only CRON_SECRET (authorizeCronStrict).
 */
import { authorizeCronStrict } from "@/lib/cron-auth";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_STATE_ROW,
  REMEDIATION_COOLDOWN_MS,
  SUBSYSTEMS,
  decideTransition,
  evaluateBuild,
  evaluateGithubSyncSubsystem,
  evaluateProviders,
  evaluateQueue,
  evaluateScheduler,
  evaluateSite,
  evaluateWorkers,
  remediationFor,
  sanitizeErrorDetail,
  signalUnavailableReport,
  type BuildLayerInfo,
  type ProviderHealthRow,
  type QueueStats,
  type RemediationKind,
  type SchedulerHeartbeat,
  type Subsystem,
  type SubsystemReport,
  type WatchdogStateRow,
  type WorkerRow,
} from "@/lib/watchdog";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Queue distress windows — identical to the uptime monitor's queue check.
const QUEUED_STALL_MIN = 20;
const LOCK_STALL_MIN = 30;

// Cap on workers re-probed in one pass so a dead fleet can't stretch the
// handler past the daemon's timeout.
const MAX_REPROBES_PER_PASS = 5;

// ─── Structural DB accessor (tables not in the generated types) ──────────────

type AnyRecord = Record<string, unknown>;
type Err = { message: string } | null;
type Maybe<T> = { data: T | null; error: Err };

interface UpdateChain extends PromiseLike<{ error: Err }> {
  eq(col: string, val: string): UpdateChain;
  or(filter: string): { select(cols: string): Promise<Maybe<AnyRecord[]>> };
  select(cols: string): Promise<Maybe<AnyRecord[]>>;
}

interface Db {
  from(table: string): {
    select(cols: string, opts?: { count?: "exact"; head?: boolean }): {
      eq(col: string, val: string): {
        maybeSingle(): Promise<Maybe<AnyRecord>>;
        lt(col: string, val: string): Promise<{ count: number | null; error: Err }>;
        or(filter: string): Promise<{ count: number | null; error: Err }>;
      };
      in(col: string, vals: string[]): Promise<Maybe<AnyRecord[]>>;
      order(col: string, opts: { ascending: boolean }): Promise<Maybe<AnyRecord[]>>;
    };
    upsert(row: AnyRecord, opts?: { onConflict?: string; ignoreDuplicates?: boolean }): Promise<{ error: Err }>;
    insert(row: AnyRecord): Promise<{ error: Err }>;
    update(patch: AnyRecord): { eq(col: string, val: string): UpdateChain };
  };
}

const db = () => supabaseAdmin as unknown as Db;

const rpc = (fn: string, args: AnyRecord) =>
  (supabaseAdmin as unknown as { rpc: (f: string, a: AnyRecord) => Promise<{ data: unknown; error: Err }> }).rpc(fn, args);

/** gpu_workers row including the probe-only columns. auth_token stays inside
 *  this handler — it is never written to state, action logs, or responses. */
interface WorkerProbeRow extends WorkerRow {
  endpoint_url: string;
  auth_token: string | null;
  protocol: string;
}

// ─── Signal gathering ────────────────────────────────────────────────────────
// Every gatherer THROWS on a Supabase error: a failed read must surface as an
// explicit "signal unavailable" report, never be mistaken for a healthy or
// actionable subsystem state.

async function gatherScheduler(): Promise<SchedulerHeartbeat | null> {
  const { data, error } = await db()
    .from("scheduler_heartbeats")
    .select("name, last_run_at, last_ok_at, last_error")
    .eq("name", "jobs_tick")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    last_run_at: (data.last_run_at as string) ?? null,
    last_ok_at: (data.last_ok_at as string) ?? null,
    // Sanitize at the boundary: heartbeat errors come from arbitrary job/
    // provider exceptions and are persisted/emailed by the watchdog.
    last_error: data.last_error ? sanitizeErrorDetail(String(data.last_error)) : null,
  };
}

async function gatherQueueStats(nowMs: number): Promise<QueueStats> {
  const queuedCutoff = new Date(nowMs - QUEUED_STALL_MIN * 60_000).toISOString();
  const lockCutoff = new Date(nowMs - LOCK_STALL_MIN * 60_000).toISOString();
  // "Stalled" = ELIGIBLE for the whole window (scheduled_at-aware, same as the
  // uptime monitor — aging by created_at alone flags freshly-eligible retries).
  const stalled = await db()
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued")
    .or(`and(scheduled_at.is.null,created_at.lt.${queuedCutoff}),scheduled_at.lt.${queuedCutoff}`);
  if (stalled.error) throw new Error(stalled.error.message);
  const locks = await db()
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "processing")
    .lt("locked_at", lockCutoff);
  if (locks.error) throw new Error(locks.error.message);
  return { stalledQueued: stalled.count ?? 0, staleLocks: locks.count ?? 0 };
}

async function gatherMonitorRows(): Promise<Map<string, AnyRecord>> {
  const { data, error } = await db()
    .from("uptime_monitor_state")
    .select("id, consecutive_failures, last_check_at")
    .in("id", ["prod", "queue", "github_sync"]);
  if (error) throw new Error(error.message);
  const map = new Map<string, AnyRecord>();
  for (const row of data ?? []) map.set(row.id as string, row);
  return map;
}

async function gatherWorkers(): Promise<WorkerProbeRow[]> {
  const { data, error } = await db()
    .from("gpu_workers")
    .select("id, name, status, endpoint_url, auth_token, protocol, paused_reason, last_probe_at")
    .order("priority", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as WorkerProbeRow[];
}

async function gatherProviderRows(): Promise<ProviderHealthRow[]> {
  const { data, error } = await db()
    .from("generation_health_state")
    .select("kind, last_check_at, alert_sent_at, recovery_sent_at")
    .order("kind", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProviderHealthRow[];
}

function gatherGithubStatus(): unknown {
  try {
    const p = path.join(process.cwd(), ".local", ".github-sync-status.json");
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null; // absent/unparseable → not configured in this environment
  }
}

function gatherBuildInfo(): BuildLayerInfo {
  const root = process.cwd();
  const outputDir = process.env.AURORA_BUILD_OUTPUT ?? path.join(root, ".output");
  const lkgDir = path.join(root, ".build-snapshots", "last-known-good");
  let lkgBuiltAt: string | null = null;
  try {
    const info = JSON.parse(fs.readFileSync(path.join(lkgDir, "BUILD_INFO.json"), "utf8")) as { builtAt?: string };
    lkgBuiltAt = info.builtAt ?? null;
  } catch {
    // no readable BUILD_INFO → treated as "no snapshot" by the evaluator
  }
  return {
    hasOutputDir: fs.existsSync(outputDir),
    hasCurrentEntry: fs.existsSync(path.join(outputDir, "server", "index.mjs")),
    hasLkg: fs.existsSync(path.join(lkgDir, "server", "index.mjs")),
    lkgBuiltAt,
    // start-prod.sh execs `<dir>/server/index.mjs`, so argv[1] tells us
    // whether the running process came from the fallback snapshot.
    servingFromFallback: (process.argv[1] ?? "").includes(".build-snapshots"),
  };
}

// ─── Remediations (allow-list implementations) ───────────────────────────────

interface ActionOutcome {
  subsystem: Subsystem;
  action: RemediationKind;
  before: AnyRecord;
  after: AnyRecord;
  result: "ok" | "failed" | "skipped";
  note: string;
}

type RemediationResult = Pick<ActionOutcome, "after" | "result" | "note">;

/** Re-run the job tick in-process via its real endpoint (same path the daemon
 *  uses), so a tick that keeps 500ing gets one extra chance plus a captured
 *  error. Idempotent: job claiming is lock-fenced. */
async function runTickRerun(): Promise<RemediationResult> {
  const port = process.env.PORT ?? "8080";
  const url = `http://127.0.0.1:${port}/api/public/jobs/tick`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65_000);
    const res = await fetch(url, {
      method: "POST",
      headers: { apikey: process.env.CRON_SECRET ?? "", "content-type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const body = (await res.json().catch(() => ({}))) as AnyRecord;
    const ok = res.ok && body.ok === true;
    return {
      result: ok ? "ok" : "failed",
      note: ok ? "tick re-ran clean" : `tick returned HTTP ${res.status}`,
      after: { http: res.status, tick_ok: body.ok === true },
    };
  } catch (e) {
    return {
      result: "failed",
      note: `tick rerun request failed: ${sanitizeErrorDetail(e instanceof Error ? e.message : String(e))}`,
      after: {},
    };
  }
}

/**
 * Re-probe auto-paused workers and resume the ones that answer healthy.
 *
 * This is the ONLY automatic resume path: the regular health sweep
 * deliberately skips paused/draining rows, so without the watchdog a worker
 * that recovers on its own would stay paused until an admin clicks Resume.
 * Only `paused_reason='auto'` rows are eligible — admin-held workers are
 * intentional and never touched — and the resume write is FENCED on the row
 * still being auto-paused, so an operator pause/drain mid-probe always wins.
 */
async function runWorkerReprobe(rows: WorkerProbeRow[], nowIso: string): Promise<RemediationResult> {
  const targets = rows
    .filter((w) => w.status === "paused" && w.paused_reason === "auto")
    .slice(0, MAX_REPROBES_PER_PASS);
  if (targets.length === 0) {
    return { result: "skipped", note: "no auto-paused workers to re-probe", after: {} };
  }
  const { probeWorkerHealth } = await import("@/lib/gpu-worker-health");
  const resumed: string[] = [];
  const stillFailing: string[] = [];
  for (const w of targets) {
    const probe = await probeWorkerHealth(w as never, 8_000);
    if (!probe.ok) {
      // Do NOT stamp last_probe_at here — leaving it stale keeps the worker
      // eligible for another re-probe once the remediation cooldown expires.
      stillFailing.push(w.name);
      continue;
    }
    // Conditional resume: matches only if the row is STILL auto-paused (an
    // admin may have flipped it to draining/paused while the 8s probe ran).
    const { data: updated, error } = await db().from("gpu_workers").update({
      status: "active",
      paused_reason: null,
      last_probe_at: nowIso,
      last_probe_ok: true,
      last_probe_error: null,
      last_heartbeat: nowIso,
      updated_at: nowIso,
    })
      .eq("id", w.id)
      .eq("status", "paused")
      .eq("paused_reason", "auto")
      .select("id");
    if (error) {
      stillFailing.push(`${w.name} (resume write failed)`);
    } else if ((updated?.length ?? 0) === 0) {
      stillFailing.push(`${w.name} (state changed during probe — left as-is)`);
    } else {
      resumed.push(w.name);
    }
  }
  return {
    result: resumed.length > 0 ? "ok" : "failed",
    note:
      resumed.length > 0
        ? `resumed: ${resumed.join(", ")}${stillFailing.length ? ` · not resumed: ${stillFailing.join(", ")}` : ""}`
        : `${stillFailing.length} worker(s) not resumed`,
    after: { resumed, stillFailing },
  };
}

/** Relaunch the github-sync daemon when its heartbeat says it died. Detached
 *  and unref'd so it outlives this request; the daemon's own REPL_ID guard
 *  makes the relaunch a no-op anywhere but the main workspace. */
function runGithubSyncRelaunch(): RemediationResult {
  const root = process.cwd();
  const statusFile = path.join(root, ".local", ".github-sync-status.json");
  if (!fs.existsSync(statusFile)) {
    return { result: "skipped", note: "no status file — sync daemon has never run in this environment", after: {} };
  }
  let alreadyRunning = false;
  try {
    execFileSync("pgrep", ["-f", "github-sync-daemon.sh"], { stdio: ["ignore", "pipe", "ignore"] });
    alreadyRunning = true;
  } catch {
    // pgrep exit 1 = no matching process — the daemon really is dead
  }
  if (alreadyRunning) {
    return { result: "skipped", note: "daemon process is actually running (status file stale)", after: {} };
  }
  const child = spawn("bash", [path.join(root, "scripts", "github-sync-daemon.sh")], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return { result: "ok", note: `relaunched github-sync daemon (pid ${child.pid})`, after: { pid: child.pid ?? null } };
}

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/api/public/watchdog")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorizeCronStrict(request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const nowMs = Date.now();
        const nowIso = new Date(nowMs).toISOString();

        // ── 1. Gather every signal. A failed read throws inside its gatherer
        // and becomes an explicit "signal unavailable" report (never mistaken
        // for a healthy or actionable state). ────────────────────────────────
        const [schedulerS, queueS, monitorsS, workersS, providersS] = await Promise.allSettled([
          gatherScheduler(),
          gatherQueueStats(nowMs),
          gatherMonitorRows(),
          gatherWorkers(),
          gatherProviderRows(),
        ]);
        const reason = (r: PromiseSettledResult<unknown>): string =>
          r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : "unknown";

        // ── 2. Load previous watchdog state. Without it we cannot dedup or
        // gate anything — fail the pass loudly instead of alerting blind. ────
        const { data: prevRows, error: prevErr } = await db()
          .from("watchdog_state")
          .select("subsystem, consecutive_failures, last_ok_at, alert_sent_at, recovery_sent_at, last_action_at")
          .in("subsystem", SUBSYSTEMS);
        if (prevErr) {
          return new Response(
            JSON.stringify({ ok: false, error: `watchdog state unreadable: ${sanitizeErrorDetail(prevErr.message)}` }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
        const prevBySub = new Map<string, WatchdogStateRow>();
        for (const row of prevRows ?? []) {
          prevBySub.set(row.subsystem as string, {
            consecutive_failures: (row.consecutive_failures as number) ?? 0,
            last_ok_at: (row.last_ok_at as string) ?? null,
            alert_sent_at: (row.alert_sent_at as string) ?? null,
            recovery_sent_at: (row.recovery_sent_at as string) ?? null,
            last_action_at: (row.last_action_at as string) ?? null,
          });
        }
        const prevFailures = (s: Subsystem) => (prevBySub.get(s) ?? DEFAULT_STATE_ROW).consecutive_failures;

        // ── 3. Evaluate reports. ─────────────────────────────────────────────
        const monitorRows = monitorsS.status === "fulfilled" ? monitorsS.value : new Map<string, AnyRecord>();
        const workerRows = workersS.status === "fulfilled" ? workersS.value : [];

        const reports: SubsystemReport[] = [
          schedulerS.status === "fulfilled"
            ? evaluateScheduler(schedulerS.value, nowMs)
            : signalUnavailableReport("scheduler", reason(schedulerS), prevFailures("scheduler")),
          queueS.status === "fulfilled"
            ? evaluateQueue(queueS.value, (monitorRows.get("queue") as { last_check_at: string | null } | undefined) ?? null, nowMs)
            : signalUnavailableReport("queue", reason(queueS), prevFailures("queue")),
          monitorsS.status === "fulfilled"
            ? evaluateSite(
                monitorRows.has("prod")
                  ? (monitorRows.get("prod") as { last_check_at: string | null; consecutive_failures: number })
                  : null,
                nowMs,
              )
            : signalUnavailableReport("site", reason(monitorsS), prevFailures("site")),
          workersS.status === "fulfilled"
            ? evaluateWorkers(workerRows, nowMs)
            : signalUnavailableReport("workers", reason(workersS), prevFailures("workers")),
          providersS.status === "fulfilled"
            ? evaluateProviders(providersS.value, nowMs)
            : signalUnavailableReport("providers", reason(providersS), prevFailures("providers")),
          evaluateGithubSyncSubsystem(
            gatherGithubStatus(),
            (monitorRows.get("github_sync") as { last_check_at: string | null } | undefined) ?? null,
            nowMs,
          ),
          evaluateBuild(gatherBuildInfo(), nowMs),
        ];

        // Seed missing rows so the atomic claims below have a row to lock.
        // ignoreDuplicates keeps existing rows intact.
        for (const r of reports) {
          if (!prevBySub.has(r.subsystem)) {
            await db().from("watchdog_state").upsert(
              { subsystem: r.subsystem, updated_at: nowIso },
              { onConflict: "subsystem", ignoreDuplicates: true },
            );
          }
        }

        // ── 4. Remediate (allow-listed, cooldown-gated, atomically claimed). ──
        const actions: ActionOutcome[] = [];
        for (const report of reports) {
          const prev = prevBySub.get(report.subsystem) ?? DEFAULT_STATE_ROW;
          const kind = remediationFor(report, prev, nowMs);
          if (!kind) continue;

          // Atomic claim: only one run may hold the remediation slot. The
          // conditional UPDATE encodes remediationDue() at the database.
          const cutoff = new Date(nowMs - REMEDIATION_COOLDOWN_MS).toISOString();
          const { data: claimed } = await db()
            .from("watchdog_state")
            .update({ last_action: kind, last_action_at: nowIso, updated_at: nowIso })
            .eq("subsystem", report.subsystem)
            .or(`last_action_at.is.null,last_action_at.lt.${cutoff}`)
            .select("subsystem");
          if ((claimed?.length ?? 0) === 0) continue; // another run holds the slot

          const before: AnyRecord = { verdict: report.verdict, detail: report.detail };
          let outcome: RemediationResult;
          try {
            if (kind === "tick_rerun") outcome = await runTickRerun();
            else if (kind === "worker_reprobe") outcome = await runWorkerReprobe(workerRows, nowIso);
            else outcome = runGithubSyncRelaunch();
          } catch (e) {
            outcome = {
              result: "failed",
              note: sanitizeErrorDetail(e instanceof Error ? e.message : String(e)),
              after: {},
            };
          }
          actions.push({ subsystem: report.subsystem, action: kind, before, ...outcome });
        }

        // ── 5. Transitions. Delivery is claimed ATOMICALLY (row lock in
        // watchdog_claim_transition) before any email is sent, so overlapping
        // passes can never double-send an alert or recovery. ─────────────────
        type Claimed = {
          report: SubsystemReport;
          kind: "alert" | "recovery";
          claimGen: number;
          prevAlert: string | null;
          prevRecovery: string | null;
          note?: string;
        };
        const claimed: Claimed[] = [];

        for (const report of reports) {
          const prev = prevBySub.get(report.subsystem) ?? DEFAULT_STATE_ROW;
          const t = decideTransition(report, prev, nowMs);
          const kinds: Array<"alert" | "recovery"> = [];
          if (t.sendAlert) kinds.push("alert");
          if (t.sendRecovery) kinds.push("recovery");
          for (const kind of kinds) {
            const { data, error } = await rpc("watchdog_claim_transition", {
              p_subsystem: report.subsystem,
              p_kind: kind,
              p_now: nowIso,
            });
            const res = data as {
              claimed?: boolean;
              claim_gen?: number;
              prev_alert_sent_at?: string | null;
              prev_recovery_sent_at?: string | null;
            } | null;
            if (error || !res?.claimed || typeof res.claim_gen !== "number") continue; // another run owns this transition
            const action = actions.find((a) => a.subsystem === report.subsystem);
            claimed.push({
              report,
              kind,
              claimGen: res.claim_gen,
              prevAlert: res.prev_alert_sent_at ?? null,
              prevRecovery: res.prev_recovery_sent_at ?? null,
              note: kind === "alert" && action ? `watchdog tried ${action.action}: ${action.note}` : undefined,
            });
          }
        }

        const alerting = claimed.filter((c) => c.kind === "alert");
        const recovering = claimed.filter((c) => c.kind === "recovery");

        if (alerting.length > 0) {
          const sent = await sendOperatorAlert({
            subject: `🐕 Aurora watchdog: ${alerting.map((a) => `${a.report.subsystem} ${a.report.verdict}`).join(" · ")}`,
            body: `
              <p style="margin:0 0 14px;font-size:15px;color:#f87171">
                The watchdog sweep found <strong>${alerting.length} subsystem(s)</strong> needing operator attention.
              </p>
              ${alerting
                .map(
                  (a) => `
              <div style="background:#1c1c2e;border:1px solid rgba(248,113,113,0.3);border-radius:8px;padding:14px;margin:0 0 10px;font-size:13px;color:#fca5a5">
                <strong style="color:#f87171">${escHtml(a.report.subsystem)}</strong> — ${escHtml(a.report.detail)}
                ${a.note ? `<br/><span style="color:#9ca3af">${escHtml(a.note)}</span>` : ""}
              </div>`,
                )
                .join("")}
              <p style="margin:8px 0 0;font-size:13px;color:#9ca3af">
                The watchdog auto-fixes what it safely can and only emails for the rest.
                State rows live in watchdog_state; every fix attempt is logged in watchdog_actions.
                This alert will not repeat until the subsystem recovers and fails again.
              </p>`,
          });
          if (sent === "rejected") {
            // Definitive rejection (Resend 4xx / no API key): the email did
            // NOT go out — roll the claims back so the next pass retries
            // instead of the outage going permanently silent.
            for (const c of alerting) await restoreClaim(c);
          } else if (sent === "ambiguous") {
            // Network/5xx: Resend may have accepted the email. Keeping the
            // claim is at-most-once for THIS attempt (a genuinely-lost email
            // stays lost until the next outage), but it guarantees NO
            // duplicates — restoring would risk re-sending one that went out.
            console.warn("[watchdog] alert delivery outcome ambiguous; claim kept (at-most-once, no duplicates)");
          }
        }

        if (recovering.length > 0) {
          const sent = await sendOperatorAlert({
            subject: `✅ Aurora watchdog: ${recovering.map((r) => r.report.subsystem).join(", ")} recovered`,
            body: `
              <p style="margin:0 0 14px;font-size:15px;color:#6ee7b7">
                The following subsystem(s) are <strong>healthy again</strong>:
              </p>
              ${recovering
                .map(
                  (r) => `
              <div style="background:#1c1c2e;border:1px solid rgba(110,231,183,0.3);border-radius:8px;padding:14px;margin:0 0 10px;font-size:13px;color:#a7f3d0">
                <strong>${escHtml(r.report.subsystem)}</strong> — ${escHtml(r.report.detail)}
              </div>`,
                )
                .join("")}`,
          });
          if (sent === "rejected") {
            for (const c of recovering) await restoreClaim(c);
          } else if (sent === "ambiguous") {
            console.warn("[watchdog] recovery delivery outcome ambiguous; claim kept (at-most-once, no duplicates)");
          }
        }

        // ── 6. Persist state (atomic increments) + action log. ──────────────
        for (const report of reports) {
          await rpc("watchdog_record_state", {
            p_subsystem: report.subsystem,
            p_status: report.verdict,
            p_detail: report.detail,
            p_degraded: report.verdict !== "ok",
            p_now: nowIso,
          });
        }
        for (const a of actions) {
          await db().from("watchdog_actions").insert({
            subsystem: a.subsystem,
            action: a.action,
            before_state: a.before,
            after_state: a.after,
            result: a.result,
          });
        }

        return new Response(
          JSON.stringify({
            ok: reports.every((r) => r.verdict === "ok"),
            checked_at: nowIso,
            subsystems: reports.map((r) => ({
              subsystem: r.subsystem,
              verdict: r.verdict,
              detail: r.detail,
              remediation: r.remediation,
              escalated: alerting.some((a) => a.report.subsystem === r.subsystem),
              recovered: recovering.some((x) => x.report.subsystem === r.subsystem),
            })),
            actions: actions.map((a) => ({
              subsystem: a.subsystem,
              action: a.action,
              result: a.result,
              note: a.note,
            })),
          }),
          { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
        );
      },
    },
  },
});

/** Roll a claimed alert/recovery stamp back after a definitively-failed send.
 *  Fenced in the RPC on the claim GENERATION: any later claim (alert or
 *  recovery) bumps the generation, so a restore from an earlier claim era is
 *  a no-op and can never erase a newer transition. */
async function restoreClaim(c: {
  report: SubsystemReport;
  kind: "alert" | "recovery";
  claimGen: number;
  prevAlert: string | null;
  prevRecovery: string | null;
}): Promise<void> {
  await rpc("watchdog_restore_transition", {
    p_subsystem: c.report.subsystem,
    p_kind: c.kind,
    p_claim_gen: c.claimGen,
    p_prev_alert: c.prevAlert,
    p_prev_recovery: c.prevRecovery,
  });
}

// ─── Email helper (same shape as the other monitors) ─────────────────────────

/**
 * Tri-state delivery outcome:
 *   "sent"      — Resend accepted it (2xx).
 *   "rejected"  — definitive non-delivery (4xx, or no API key configured).
 *                 Safe to roll the claim back and retry next pass.
 *   "ambiguous" — network error or 5xx: Resend may or may not have accepted
 *                 it. The claim is KEPT (at-most-once for this attempt — no
 *                 retry, but also no possible duplicate), because restoring
 *                 could re-send an email that did go out.
 */
type DeliveryOutcome = "sent" | "rejected" | "ambiguous";

async function sendOperatorAlert(opts: { subject: string; body: string }): Promise<DeliveryOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "rejected";

  const to = process.env.AURORA_ALERT_EMAIL || "hello@auroraperformancestudio.com";
  const from =
    process.env.AURORA_FROM_EMAIL || "Aurora Watchdog <noreply@auroraperformancestudio.com>";

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Aurora Watchdog Alert</title></head>
<body style="margin:0;padding:0;background:#080a12;font-family:system-ui,-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080a12">
<tr><td align="center" style="padding:40px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
  <tr><td style="padding-bottom:24px;text-align:center">
    <span style="font-size:22px;font-weight:800;color:#a78bfa">Aurora</span><span style="font-size:22px;font-weight:300;color:#6b7280"> Performance Studio</span>
  </td></tr>
  <tr><td style="background:#0f1123;border:1px solid rgba(167,139,250,0.18);border-radius:14px;padding:32px 28px">
    ${opts.body}
  </td></tr>
  <tr><td style="padding-top:18px;text-align:center;font-size:11px;color:#374151">
    Aurora Performance Studio &nbsp;·&nbsp; System Watchdog
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: opts.subject, html }),
    });
    if (res.ok) return "sent";
    // 4xx is a definitive rejection (bad key/payload/rate-limit — nothing was
    // sent); 5xx is ambiguous (Resend-side failure, delivery unknown).
    return res.status >= 400 && res.status < 500 ? "rejected" : "ambiguous";
  } catch {
    return "ambiguous";
  }
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
