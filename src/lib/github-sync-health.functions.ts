import { createServerFn } from "@tanstack/react-start";
import fs from "node:fs";
import path from "node:path";

export interface GitHubSyncHealth {
  /** ISO-8601 UTC timestamp of the last daemon cycle, or null if the status file doesn't exist yet */
  last_check_at: string | null;
  /** ISO-8601 UTC timestamp of the last successful push, or null if never */
  last_success_at: string | null;
  /** Number of consecutive cycles without a successful push */
  consecutive_failures: number;
  /** Why the last cycle(s) failed, or null if healthy */
  failure_reason: "token_unset" | "token_invalid" | "push_failed" | null;
  /** Current auth back-off in seconds (0 = not backing off) */
  auth_backoff_seconds: number;
  /** Derived: seconds since last_check_at, or null if unknown */
  seconds_since_check: number | null;
  /** Derived: seconds since last_success_at, or null if never */
  seconds_since_success: number | null;
  /** Derived: daemon is considered stalled when no check has landed in >3× the poll interval (90s default) */
  daemon_stalled: boolean;
}

export const getGitHubSyncHealth = createServerFn({ method: "GET" }).handler(
  async (): Promise<GitHubSyncHealth> => {
    // Low-sensitivity status data; the admin page is already gated by
    // AdminGate + role assertion in adminOverview — no need to double-check here.
    const root = path.resolve(process.cwd());
    const statusPath = path.join(root, ".local", ".github-sync-status.json");

    const now = Date.now();
    // Consider the daemon stalled if no heartbeat in the last 90 s
    const STALL_THRESHOLD_MS = 90_000;

    let raw: {
      last_check_at?: string | null;
      last_success_at?: string | null;
      consecutive_failures?: number;
      failure_reason?: string | null;
      auth_backoff_seconds?: number;
    } | null = null;

    try {
      const text = fs.readFileSync(statusPath, "utf8");
      raw = JSON.parse(text);
    } catch {
      // File doesn't exist yet (daemon hasn't written its first cycle)
    }

    const last_check_at = raw?.last_check_at ?? null;
    const last_success_at = raw?.last_success_at ?? null;
    const consecutive_failures = raw?.consecutive_failures ?? 0;
    const auth_backoff_seconds = raw?.auth_backoff_seconds ?? 0;

    const rawReason = raw?.failure_reason ?? null;
    const failure_reason = (
      rawReason === "token_unset" ||
      rawReason === "token_invalid" ||
      rawReason === "push_failed"
        ? rawReason
        : null
    ) as GitHubSyncHealth["failure_reason"];

    const seconds_since_check = last_check_at
      ? Math.round((now - new Date(last_check_at).getTime()) / 1000)
      : null;

    const seconds_since_success = last_success_at
      ? Math.round((now - new Date(last_success_at).getTime()) / 1000)
      : null;

    // Daemon is stalled if:
    // - status file doesn't exist (daemon never started or was deleted), OR
    // - last heartbeat is older than the stall threshold
    const daemon_stalled =
      last_check_at === null ||
      (seconds_since_check !== null && seconds_since_check * 1000 > STALL_THRESHOLD_MS);

    return {
      last_check_at,
      last_success_at,
      consecutive_failures,
      failure_reason,
      auth_backoff_seconds,
      seconds_since_check,
      seconds_since_success,
      daemon_stalled,
    };
  },
);
