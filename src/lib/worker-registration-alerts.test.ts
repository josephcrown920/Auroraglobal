import { describe, it, expect } from "bun:test";
import {
  computeWorkerAlerts,
  PENDING_STALE_MINUTES,
  ATTEMPT_WINDOW_HOURS,
} from "./worker-registration-alerts.server";

const NOW = new Date("2026-08-10T12:00:00Z").getTime();
const ago = (minutes: number) =>
  new Date(NOW - minutes * 60_000).toISOString();

// ── helpers ───────────────────────────────────────────────────────────────────

function worker(overrides: Record<string, unknown> = {}) {
  return {
    id: "w-1",
    name: "RTX 5090",
    status: "active",
    endpoint_url: "https://rtx5090.example.com",
    created_at: ago(120),
    last_heartbeat: ago(2),
    paused_reason: null,
    last_probe_ok: true,
    last_probe_error: null,
    last_probe_detail: null,
    ...overrides,
  };
}

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    id: "a-1",
    name: "RTX 5090",
    endpoint_url: "https://rtx5090.example.com",
    ok: false,
    error: "Some error",
    outcome: null,
    created_at: ago(10),
    ...overrides,
  };
}

// ── PENDING_STALE ─────────────────────────────────────────────────────────────

describe("pending_stale", () => {
  it("emits warning when worker has been in pending_approval beyond the threshold", () => {
    const w = worker({
      status: "pending_approval",
      created_at: ago(PENDING_STALE_MINUTES + 5),
    });
    const alerts = computeWorkerAlerts([w], [], NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("pending_stale");
    expect(alerts[0].severity).toBe("warning");
    expect(alerts[0].workerId).toBe("w-1");
  });

  it("does NOT emit when worker just entered pending_approval within threshold", () => {
    const w = worker({
      status: "pending_approval",
      created_at: ago(PENDING_STALE_MINUTES - 1),
    });
    const alerts = computeWorkerAlerts([w], [], NOW);
    expect(alerts).toHaveLength(0);
  });

  it("does NOT emit for active workers", () => {
    const w = worker({ status: "active" });
    const alerts = computeWorkerAlerts([w], [], NOW);
    expect(alerts).toHaveLength(0);
  });
});

// ── UNREACHABLE ───────────────────────────────────────────────────────────────

describe("unreachable", () => {
  it("emits error for auto-paused worker", () => {
    const w = worker({
      status: "paused",
      paused_reason: "auto",
      last_probe_error: "ECONNREFUSED",
      last_heartbeat: ago(15),
    });
    const alerts = computeWorkerAlerts([w], [], NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("unreachable");
    expect(alerts[0].severity).toBe("error");
    expect(alerts[0].detail).toContain("ECONNREFUSED");
    expect(alerts[0].detail).toContain("15 min ago");
  });

  it("does NOT emit for admin-paused workers", () => {
    const w = worker({ status: "paused", paused_reason: "admin" });
    const alerts = computeWorkerAlerts([w], [], NOW);
    expect(alerts).toHaveLength(0);
  });

  it("does NOT emit for draining workers", () => {
    const w = worker({ status: "draining" });
    const alerts = computeWorkerAlerts([w], [], NOW);
    expect(alerts).toHaveLength(0);
  });
});

// ── AUTH_FAILURE ──────────────────────────────────────────────────────────────

describe("auth_failure", () => {
  it("emits error alert for recent auth failure attempts", () => {
    const a = attempt({
      error: "Unauthorized — Expected abcd1234 got deadbeef",
      created_at: ago(30),
    });
    const alerts = computeWorkerAlerts([], [a], NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("auth_failure");
    expect(alerts[0].severity).toBe("error");
    expect(alerts[0].detail).toContain("deadbeef");
    expect(alerts[0].detail).toContain("abcd1234");
  });

  it("includes attemptCount from multiple recent failures", () => {
    const attempts = [1, 2, 3].map((i) =>
      attempt({
        id: `a-${i}`,
        error: "Unauthorized token mismatch",
        created_at: ago(10 * i),
      }),
    );
    const alerts = computeWorkerAlerts([], attempts, NOW);
    expect(alerts[0].attemptCount).toBe(3);
  });

  it("ignores auth failures outside the time window", () => {
    const a = attempt({
      error: "Unauthorized secret mismatch",
      created_at: ago((ATTEMPT_WINDOW_HOURS + 1) * 60),
    });
    const alerts = computeWorkerAlerts([], [a], NOW);
    expect(alerts).toHaveLength(0);
  });

  it("links to the matched worker row when endpoint matches a gpu_workers entry", () => {
    const w = worker({ status: "paused", paused_reason: "admin" });
    const a = attempt({ error: "Unauthorized — token mismatch" });
    const alerts = computeWorkerAlerts([w], [a], NOW);
    const authAlert = alerts.find((al) => al.kind === "auth_failure");
    expect(authAlert).toBeDefined();
    expect(authAlert!.workerId).toBe("w-1");
  });

  it("still emits auth_failure even when a worker row exists (wrong secret scenario)", () => {
    const w = worker({ status: "active" }); // worker exists but sending wrong secret
    const a = attempt({ error: "Unauthorized — secret mismatch" });
    const alerts = computeWorkerAlerts([w], [a], NOW);
    expect(alerts.some((al) => al.kind === "auth_failure")).toBe(true);
  });
});

// ── AUTH_FAILURE with the REAL register-route audit shape ─────────────────────
// The actual /workers/register auth-mismatch path rejects BEFORE parsing the
// body, so its worker_register_attempts row has name:null, endpoint_url:null
// and error "Unauthorized (apikey mismatch or missing) — received fp:<hex> expected fp:<hex>".

describe("auth_failure — real register-route audit records (no endpoint)", () => {
  it("emits auth_failure with fingerprint diagnostics for an endpoint-less mismatch record", () => {
    const a = attempt({
      name: null,
      endpoint_url: null,
      error: "Unauthorized (apikey mismatch or missing) — received fp:deadbeef expected fp:abcd1234",
      created_at: ago(15),
    });
    const alerts = computeWorkerAlerts([], [a], NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("auth_failure");
    expect(alerts[0].severity).toBe("error");
    expect(alerts[0].detail).toContain("deadbeef");
    expect(alerts[0].detail).toContain("abcd1234");
    expect(alerts[0].title).toContain("unknown source");
  });

  it("handles the missing-apikey variant (received fp:none)", () => {
    const a = attempt({
      name: null,
      endpoint_url: null,
      error: "Unauthorized (apikey mismatch or missing) — received fp:none expected fp:abcd1234",
    });
    const alerts = computeWorkerAlerts([], [a], NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("auth_failure");
    expect(alerts[0].detail).toContain("NO apikey");
    expect(alerts[0].detail).toContain("abcd1234");
  });

  it("groups multiple endpoint-less mismatch attempts into one alert with a count", () => {
    const attempts = [1, 2, 3].map((i) =>
      attempt({
        id: `a-${i}`,
        name: null,
        endpoint_url: null,
        error: "Unauthorized (apikey mismatch or missing) — received fp:deadbeef expected fp:abcd1234",
        created_at: ago(5 * i),
      }),
    );
    const alerts = computeWorkerAlerts([], attempts, NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].attemptCount).toBe(3);
  });

  it("surfaces non-auth endpoint-less failures (e.g. invalid JSON) as never_registered", () => {
    const a = attempt({
      name: null,
      endpoint_url: null,
      error: "Invalid JSON body",
    });
    const alerts = computeWorkerAlerts([], [a], NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("never_registered");
    expect(alerts[0].detail).toContain("Invalid JSON body");
  });

  it("surfaces the registration-disabled audit record", () => {
    const a = attempt({
      name: null,
      endpoint_url: null,
      error: "Registration disabled: AURORA_REGISTER_SECRET is not configured",
    });
    const alerts = computeWorkerAlerts([], [a], NOW);
    expect(alerts).toHaveLength(1);
    // "SECRET" matches the auth-error heuristic — correct: it IS an auth/config problem.
    expect(alerts[0].kind).toBe("auth_failure");
  });
});

// ── NEVER_REGISTERED ──────────────────────────────────────────────────────────

describe("never_registered", () => {
  it("emits warning when failures come from an unknown endpoint", () => {
    const a = attempt({
      endpoint_url: "https://new-gpu.example.com",
      error: "invalid JSON payload",
      created_at: ago(20),
    });
    const alerts = computeWorkerAlerts([], [a], NOW);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].kind).toBe("never_registered");
    expect(alerts[0].severity).toBe("warning");
  });

  it("does NOT emit never_registered when a gpu_workers row exists for that endpoint", () => {
    const w = worker({ endpoint_url: "https://new-gpu.example.com", status: "paused", paused_reason: "admin" });
    const a = attempt({
      endpoint_url: "https://new-gpu.example.com",
      error: "invalid JSON payload",
      created_at: ago(20),
    });
    const alerts = computeWorkerAlerts([w], [a], NOW);
    // Non-auth failure with existing worker row → no alert
    expect(alerts.every((al) => al.kind !== "never_registered")).toBe(true);
  });

  it("normalises trailing /generate when correlating endpoint to gpu_workers", () => {
    // Worker row stored with bare origin; attempt used the /generate path
    const w = worker({ endpoint_url: "https://rtx5090.example.com" });
    const a = attempt({
      endpoint_url: "https://rtx5090.example.com/generate",
      error: "Unauthorized — secret mismatch",
    });
    const alerts = computeWorkerAlerts([w], [a], NOW);
    // Should correlate to the existing worker, not emit never_registered
    const neverReg = alerts.find((al) => al.kind === "never_registered");
    expect(neverReg).toBeUndefined();
    const authFail = alerts.find((al) => al.kind === "auth_failure");
    expect(authFail?.workerId).toBe("w-1");
  });
});

// ── SUCCESSFUL registration suppresses alerts ─────────────────────────────────

describe("clean state", () => {
  it("emits no alerts when worker is active and recent attempts are all successful", () => {
    const w = worker({ status: "active" });
    const a = { ...attempt(), ok: true, error: null };
    const alerts = computeWorkerAlerts([w], [a], NOW);
    expect(alerts).toHaveLength(0);
  });

  it("emits no alerts with an empty DB", () => {
    const alerts = computeWorkerAlerts([], [], NOW);
    expect(alerts).toHaveLength(0);
  });
});
