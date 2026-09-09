// Demand-driven controller for Aurora's single motion-capacity pool.
// It deliberately reuses the existing Vast lifecycle, whose pre-create
// reservation and one-hour deadline remain the final paid-spend safeguards.

import { normalizeWorkerBase, probeWorkerHealth } from "./gpu-worker-health";
import type { ManagedInstanceRow, VastLifecycle } from "./vast-lifecycle.server";

export const MOTION_AUTOSCALE_IDLE_MS = 5 * 60_000;
export const MOTION_AUTOSCALE_READINESS_MS = 12 * 60_000;
export const MOTION_AUTOSCALE_COOLDOWN_MS = 15 * 60_000;
export const MOTION_AUTOSCALER_ACTOR_ID = "00000000-0000-0000-0000-000000000001";
const STALE_HEARTBEAT_MS = 5 * 60_000;
const VAST_HOURLY_CEILING_USD = 0.35;

export type MotionAutoscaleState = {
  enabled: boolean;
  cooldown_until: string | null;
  failure_count: number;
  failure_reason: string | null;
  decision_lease_until: string | null;
  last_activity_at: string | null;
  last_decision_at: string | null;
  last_decision_action: string | null;
  last_decision_provider: "runpod" | "vast" | null;
  last_decision_reason: string | null;
};

export type MotionAutoscaleWorker = {
  id: string;
  name: string;
  endpoint_url: string;
  auth_token: string | null;
  protocol: string | null;
  capabilities: string[] | null;
  status: string;
  in_flight: number;
  max_concurrency: number;
  last_heartbeat: string | null;
};

export type MotionJob = { status: string };

export type MotionAutoscaleRepo = {
  getState(): Promise<MotionAutoscaleState>;
  patchState(patch: Partial<MotionAutoscaleState>): Promise<void>;
  claimDecision(action: "provision" | "destroy" | "readiness_timeout", provider: "runpod" | "vast"): Promise<boolean>;
  listMotionJobs(): Promise<MotionJob[]>;
  listMotionWorkers(): Promise<MotionAutoscaleWorker[]>;
  listManagedVast(): Promise<ManagedInstanceRow[]>;
};

export type MotionAutoscaleStatus = {
  enabled: boolean;
  backlog: { queued: number; processing: number };
  selectedProvider: "runpod" | "vast" | "none";
  cooldown: { active: boolean; until: string | null; reason: string | null };
  worker: { name: string; status: string; ready: boolean; spareConcurrency: number } | null;
  vast: { state: string; gpuName: string | null; hourlyUsd: number; destroyDeadline: string } | null;
  runpod: { configured: boolean; registered: boolean; endpointReady: boolean } | null;
  lastDecision: { at: string | null; action: string | null; provider: string | null; reason: string | null };
  checkedAt: string;
};

export type MotionAutoscalerDeps = {
  repo: MotionAutoscaleRepo;
  lifecycle: VastLifecycle;
  now?: () => Date;
  runpod?: { endpointId?: string; apiKey?: string };
  probe?: typeof probeWorkerHealth;
  log?: (message: string, error?: unknown) => void;
};

function endpointForRunpod(endpointId: string): string | null {
  return /^[A-Za-z0-9_-]{6,100}$/.test(endpointId)
    ? `https://api.runpod.ai/v2/${endpointId}`
    : null;
}

function hasMotionCapability(worker: MotionAutoscaleWorker): boolean {
  return worker.capabilities?.includes("motion") ?? false;
}

function isFresh(worker: MotionAutoscaleWorker, nowMs: number): boolean {
  return !!worker.last_heartbeat && nowMs - new Date(worker.last_heartbeat).getTime() <= STALE_HEARTBEAT_MS;
}

function canDispatch(worker: MotionAutoscaleWorker, nowMs: number): boolean {
  return worker.status === "active"
    && hasMotionCapability(worker)
    && isFresh(worker, nowMs)
    && worker.in_flight < worker.max_concurrency;
}

function isActiveVast(row: ManagedInstanceRow): boolean {
  return row.state === "renting" || row.state === "running" || row.state === "stopped";
}

function safeFailureReason(error: unknown): string {
  // Never persist raw provider bodies: their errors can reflect request data.
  return error instanceof Error && /AURORA_REGISTER_SECRET|Confirmation required|ceiling|24/i.test(error.message)
    ? "Vast provisioning rejected by Aurora guardrails"
    : "Vast provisioning failed; see server logs";
}

export function createMotionAutoscaler(deps: MotionAutoscalerDeps) {
  const now = deps.now ?? (() => new Date());
  const probe = deps.probe ?? probeWorkerHealth;
  const log = deps.log ?? ((message, error) => console.error(`[motion-autoscaler] ${message}`, error ?? ""));

  async function snapshot() {
    const [state, jobs, workers, vastRows] = await Promise.all([
      deps.repo.getState(),
      deps.repo.listMotionJobs(),
      deps.repo.listMotionWorkers(),
      deps.repo.listManagedVast(),
    ]);
    const nowDate = now();
    const nowMs = nowDate.getTime();
    const queued = jobs.filter((job) => job.status === "queued" || job.status === "pending").length;
    const processing = jobs.filter((job) => job.status === "processing" || job.status === "finalizing").length;
    return { state, workers, vastRows, queued, processing, nowDate, nowMs };
  }

  async function runpodReadiness(workers: MotionAutoscaleWorker[]) {
    const endpoint = endpointForRunpod(deps.runpod?.endpointId ?? "");
    const configured = Boolean(endpoint && deps.runpod?.apiKey);
    if (!configured || !endpoint) return { configured, registered: false, endpointReady: false, worker: null as MotionAutoscaleWorker | null };
    const worker = workers.find((candidate) =>
      candidate.protocol === "runpod"
      && hasMotionCapability(candidate)
      && normalizeWorkerBase(candidate.endpoint_url) === endpoint,
    ) ?? null;
    if (!worker || worker.status !== "active") return { configured, registered: !!worker, endpointReady: false, worker };
    const result = await probe(
      { endpoint_url: endpoint, protocol: "runpod", auth_token: deps.runpod?.apiKey ?? null },
      8_000,
    );
    return { configured, registered: true, endpointReady: result.ok, worker };
  }

  function toStatus(
    input: Awaited<ReturnType<typeof snapshot>>,
    runpod: Awaited<ReturnType<typeof runpodReadiness>>,
  ): MotionAutoscaleStatus {
    const activeVast = input.vastRows.find(isActiveVast) ?? null;
    const dispatchable = input.workers.find((worker) => canDispatch(worker, input.nowMs)) ?? null;
    const cooldownActive = !!input.state.cooldown_until && new Date(input.state.cooldown_until).getTime() > input.nowMs;
    const selectedProvider = dispatchable?.protocol === "runpod"
      ? "runpod"
      : activeVast ? "vast" : "none";
    return {
      enabled: input.state.enabled,
      backlog: { queued: input.queued, processing: input.processing },
      selectedProvider,
      cooldown: { active: cooldownActive, until: input.state.cooldown_until, reason: input.state.failure_reason },
      worker: dispatchable
        ? {
            name: dispatchable.name,
            status: dispatchable.status,
            ready: true,
            spareConcurrency: Math.max(0, dispatchable.max_concurrency - dispatchable.in_flight),
          }
        : null,
      vast: activeVast
        ? {
            state: activeVast.state,
            gpuName: activeVast.gpu_name,
            hourlyUsd: Number(activeVast.hourly_usd),
            destroyDeadline: activeVast.destroy_deadline,
          }
        : null,
      runpod: {
        configured: runpod.configured,
        registered: runpod.registered,
        endpointReady: runpod.endpointReady,
      },
      lastDecision: {
        at: input.state.last_decision_at,
        action: input.state.last_decision_action,
        provider: input.state.last_decision_provider,
        reason: input.state.last_decision_reason,
      },
      checkedAt: input.nowDate.toISOString(),
    };
  }

  async function recordDecision(
    action: string,
    provider: "runpod" | "vast" | null,
    reason: string,
    extra: Partial<MotionAutoscaleState> = {},
  ) {
    await deps.repo.patchState({
      ...extra,
      decision_lease_until: null,
      last_decision_at: now().toISOString(),
      last_decision_action: action,
      last_decision_provider: provider,
      last_decision_reason: reason.slice(0, 240),
    });
  }

  async function recordFailure(reason: string) {
    const at = now();
    const current = await deps.repo.getState();
    await recordDecision("failed", "vast", reason, {
      failure_count: Math.min(100, current.failure_count + 1),
      failure_reason: reason,
      cooldown_until: new Date(at.getTime() + MOTION_AUTOSCALE_COOLDOWN_MS).toISOString(),
    });
  }

  async function status(): Promise<MotionAutoscaleStatus> {
    const current = await snapshot();
    const runpod = await runpodReadiness(current.workers);
    return toStatus(current, runpod);
  }

  async function reconcile(): Promise<MotionAutoscaleStatus> {
    const current = await snapshot();
    const runpod = await runpodReadiness(current.workers);
    const backlog = current.queued + current.processing;
    const activeVast = current.vastRows.find(isActiveVast) ?? null;
    const autoscaledVast = activeVast?.created_by === MOTION_AUTOSCALER_ACTOR_ID ? activeVast : null;
    const dispatchable = current.workers.find((worker) => canDispatch(worker, current.nowMs)) ?? null;
    const cooldownActive = !!current.state.cooldown_until
      && new Date(current.state.cooldown_until).getTime() > current.nowMs;

    if (!current.state.enabled) return toStatus(current, runpod);

    if (backlog > 0 || dispatchable) {
      await deps.repo.patchState({ last_activity_at: current.nowDate.toISOString() });
    }

    // This is intentionally before every backlog/capacity branch. The lifecycle
    // deadline is an absolute paid-spend boundary, not an idle-only preference.
    if (autoscaledVast && new Date(autoscaledVast.destroy_deadline).getTime() <= current.nowMs) {
      if (await deps.repo.claimDecision("destroy", "vast")) {
        try {
          await deps.lifecycle.destroy(autoscaledVast.id, "autoscaler absolute one-hour deadline");
          await recordDecision("destroyed_deadline", "vast", "Managed Vast reached its absolute one-hour deadline");
        } catch (error) {
          log("deadline destroy failed", error);
          await recordFailure("Managed Vast deadline teardown failed; see server logs");
        }
      }
      return status();
    }

    if (backlog === 0 && autoscaledVast) {
      const activityAt = current.state.last_activity_at
        ? new Date(current.state.last_activity_at).getTime()
        : new Date(autoscaledVast.created_at).getTime();
      if (current.nowMs - activityAt >= MOTION_AUTOSCALE_IDLE_MS) {
        if (await deps.repo.claimDecision("destroy", "vast")) {
          try {
            await deps.lifecycle.destroy(autoscaledVast.id, "autoscaler idle scale-down");
            await recordDecision("destroyed_idle", "vast", "No queued or processing motion work");
          } catch (error) {
            log("idle destroy failed", error);
            await recordFailure("Managed Vast idle teardown failed; see server logs");
          }
        }
      }
      return status();
    }

    if (backlog === 0) return toStatus(current, runpod);
    if (dispatchable) {
      await recordDecision("capacity_ready", dispatchable.protocol === "runpod" ? "runpod" : "vast", "An eligible motion worker has capacity");
      return status();
    }

    // A registered, healthy RunPod endpoint owns its single provider-native
    // scale-to-zero worker. Do not rent Vast alongside it simply because its
    // one worker is temporarily occupied.
    if (runpod.endpointReady && runpod.worker) {
      await recordDecision("runpod_waiting", "runpod", "RunPod endpoint is healthy; awaiting its worker capacity");
      return status();
    }

    if (activeVast) {
      if (!autoscaledVast) {
        await recordDecision("manual_vast_waiting", "vast", "A manually managed Vast instance is active");
        return status();
      }
      const readyBy = new Date(autoscaledVast.created_at).getTime() + MOTION_AUTOSCALE_READINESS_MS;
      if (current.nowMs >= readyBy && !cooldownActive && await deps.repo.claimDecision("readiness_timeout", "vast")) {
        try {
          await deps.lifecycle.destroy(autoscaledVast.id, "autoscaler readiness timeout");
          await recordFailure("Managed Vast worker did not register healthy motion capacity in time");
        } catch (error) {
          log("readiness teardown failed", error);
          await recordFailure("Managed Vast readiness teardown failed; see server logs");
        }
      }
      return status();
    }

    if (cooldownActive) return toStatus(current, runpod);
    if (!(await deps.repo.claimDecision("provision", "vast"))) return status();

    try {
      const proposal = (await deps.lifecycle.search({ minGpuRamGb: 24, limit: 10 }))
        .filter((candidate) => candidate.offer.gpu_ram_gb >= 24 && candidate.offer.dph_total <= VAST_HOURLY_CEILING_USD)
        .sort((a, b) => a.offer.dph_total - b.offer.dph_total)[0];
      if (!proposal) throw new Error("No eligible 24 GB Vast offer");
      const registerSecret = process.env.AURORA_REGISTER_SECRET;
      if (!registerSecret) throw new Error("AURORA_REGISTER_SECRET is unavailable");
      await deps.lifecycle.provision({
        offerId: proposal.offer.id,
        hourlyUsd: proposal.offer.dph_total,
        confirmToken: proposal.confirmToken,
        userId: MOTION_AUTOSCALER_ACTOR_ID,
        tasks: "motion",
        name: "motion-autoscaler",
        registerSecret,
      });
      await recordDecision("provisioned", "vast", "Motion backlog required one managed fallback worker", {
        failure_count: 0,
        failure_reason: null,
        cooldown_until: null,
      });
    } catch (error) {
      log("provision failed", error);
      await recordFailure(safeFailureReason(error));
    }
    return status();
  }

  return { status, reconcile };
}