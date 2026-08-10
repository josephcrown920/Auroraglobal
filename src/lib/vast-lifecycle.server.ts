// Aurora-managed Vast.ai GPU lifecycle service (owner/admin-only).
//
// Guardrails (enforced HERE, server-side — the CLI cannot bypass them):
//   • Price ceiling: never rent above VAST_MAX_HOURLY_USD ($0.35/hr).
//   • Runtime cap:   every managed instance gets a hard 1-hour destroy
//     deadline; the expiry cron destroys anything past it.
//   • Explicit confirmation: creating a billable rental is a two-step flow —
//     `propose` returns an HMAC confirm token binding offerId+price+expiry;
//     `provision` refuses without a valid, unexpired token.
//   • Scope: stop/destroy only act on rows in vast_managed_instances. Aurora
//     never touches Vast instances it doesn't manage (manually rented boxes
//     stay untouched unless the owner explicitly adopts them).
//   • No SSH keys or Vast passwords are stored anywhere — provisioning is
//     driven entirely by the onstart bootstrap + worker self-registration.
//
// Dependency-injected so tests can exercise every guardrail without touching
// Vast or the live database.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { VastClient, VastInstance, VastOffer } from "@/lib/vast-api.server";

export const VAST_MAX_HOURLY_USD = 0.35;
export const VAST_MAX_RUNTIME_MS = 60 * 60 * 1000; // 1 hour hard cap
export const VAST_CONFIRM_TTL_MS = 10 * 60 * 1000; // confirm token validity

export type ManagedInstanceRow = {
  id: string;
  vast_instance_id: number;
  label: string;
  gpu_name: string | null;
  hourly_usd: number;
  adopted: boolean;
  endpoint_url: string | null;
  worker_id: string | null;
  state: "renting" | "running" | "stopped" | "destroyed" | "expired" | "failed";
  failure_reason: string | null;
  created_by: string;
  created_at: string;
  destroy_deadline: string;
  destroyed_at: string | null;
};

/** Minimal persistence interface — implemented over Supabase in production,
 *  by an in-memory fake in tests. */
export type ManagedRepo = {
  getByVastId(vastId: number): Promise<ManagedInstanceRow | null>;
  get(id: string): Promise<ManagedInstanceRow | null>;
  insert(row: Omit<ManagedInstanceRow, "id" | "created_at">): Promise<ManagedInstanceRow>;
  update(id: string, patch: Partial<ManagedInstanceRow>): Promise<void>;
  /** Rows in a non-terminal state (renting/running/stopped). */
  listActive(): Promise<ManagedInstanceRow[]>;
  /** All rows, newest first (for status display). */
  listRecent(limit: number): Promise<ManagedInstanceRow[]>;
};

export type LifecycleDeps = {
  vast: VastClient;
  repo: ManagedRepo;
  now: () => Date;
  /** HMAC secret for confirm tokens (SESSION_SECRET in prod). */
  confirmSecret: string;
  /** Public Aurora URL the worker bootstrap registers against. */
  appUrl: string;
};

export class VastGuardrailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VastGuardrailError";
  }
}

// ── Confirmation tokens ───────────────────────────────────────────────────────
// Stateless: HMAC over (offerId, price, expiry). Server re-verifies the offer
// price at provision time anyway; the token only proves the caller saw and
// approved THIS offer at THIS price recently.

function tokenPayload(offerId: number, hourlyUsd: number, expiresAtMs: number): string {
  return `vast-confirm:${offerId}:${hourlyUsd.toFixed(4)}:${expiresAtMs}`;
}

export function makeConfirmToken(
  secret: string,
  offerId: number,
  hourlyUsd: number,
  expiresAtMs: number,
): string {
  const mac = createHmac("sha256", secret).update(tokenPayload(offerId, hourlyUsd, expiresAtMs)).digest("base64url");
  return `${expiresAtMs}.${mac}`;
}

export function verifyConfirmToken(
  secret: string,
  token: string,
  offerId: number,
  hourlyUsd: number,
  nowMs: number,
): { ok: true } | { ok: false; reason: string } {
  const dot = token.indexOf(".");
  if (dot <= 0) return { ok: false, reason: "Malformed confirm token" };
  const expiresAtMs = Number(token.slice(0, dot));
  if (!Number.isFinite(expiresAtMs)) return { ok: false, reason: "Malformed confirm token" };
  if (nowMs > expiresAtMs) return { ok: false, reason: "Confirm token expired — run `aurora vast search` again" };
  const expected = createHmac("sha256", secret)
    .update(tokenPayload(offerId, hourlyUsd, expiresAtMs))
    .digest("base64url");
  const got = token.slice(dot + 1);
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "Confirm token does not match this offer/price" };
  }
  return { ok: true };
}

// ── Endpoint derivation ───────────────────────────────────────────────────────

/** Public worker URL from a Vast instance's port mapping (container port 8000). */
export function endpointFromInstance(inst: VastInstance): string | null {
  const mapping = inst.ports?.["8000/tcp"];
  const entry = Array.isArray(mapping) ? mapping[0] : undefined;
  const host = entry?.HostIp && entry.HostIp !== "0.0.0.0" ? entry.HostIp : inst.public_ipaddr;
  const port = entry?.HostPort;
  if (!host || !port) return null;
  return `http://${host}:${port}`;
}

// ── Service ───────────────────────────────────────────────────────────────────

export type OfferProposal = {
  offer: VastOffer;
  confirmToken: string;
  confirmExpiresAt: string;
  maxHourlyUsd: number;
  maxRuntimeMinutes: number;
};

export function createVastLifecycle(deps: LifecycleDeps) {
  const { vast, repo, now, confirmSecret, appUrl } = deps;

  async function requireManaged(idOrVastId: string): Promise<ManagedInstanceRow> {
    const byId = /^[0-9]+$/.test(idOrVastId)
      ? await repo.getByVastId(Number(idOrVastId))
      : await repo.get(idOrVastId);
    if (!byId) {
      throw new VastGuardrailError(
        `Instance ${idOrVastId} is not managed by Aurora. Aurora only controls instances it created or you explicitly adopted (aurora vast adopt <id>).`,
      );
    }
    return byId;
  }

  return {
    /** Search rentable offers under the price ceiling, each with a confirm token. */
    async search(opts?: { minGpuRamGb?: number; limit?: number }): Promise<OfferProposal[]> {
      const offers = await vast.searchOffers({
        maxHourlyUsd: VAST_MAX_HOURLY_USD,
        minGpuRamGb: opts?.minGpuRamGb,
        limit: opts?.limit ?? 10,
      });
      const expiresAtMs = now().getTime() + VAST_CONFIRM_TTL_MS;
      return offers
        .filter((o) => o.dph_total <= VAST_MAX_HOURLY_USD) // belt & braces over the API-side filter
        .map((offer) => ({
          offer,
          confirmToken: makeConfirmToken(confirmSecret, offer.id, offer.dph_total, expiresAtMs),
          confirmExpiresAt: new Date(expiresAtMs).toISOString(),
          maxHourlyUsd: VAST_MAX_HOURLY_USD,
          maxRuntimeMinutes: VAST_MAX_RUNTIME_MS / 60_000,
        }));
    },

    /** Rent an instance from a previously proposed offer. Requires the confirm
     *  token from `search` — there is no way to create a billable rental in a
     *  single call. */
    async provision(input: {
      offerId: number;
      hourlyUsd: number;
      confirmToken: string;
      userId: string;
      tasks?: string;
      name?: string;
      registerSecret: string;
    }): Promise<ManagedInstanceRow> {
      const nowDate = now();

      if (!(input.hourlyUsd > 0) || input.hourlyUsd > VAST_MAX_HOURLY_USD) {
        throw new VastGuardrailError(
          `Offer price $${input.hourlyUsd}/hr exceeds the Aurora ceiling of $${VAST_MAX_HOURLY_USD}/hr. Aurora never bids above the ceiling.`,
        );
      }
      const check = verifyConfirmToken(
        confirmSecret,
        input.confirmToken ?? "",
        input.offerId,
        input.hourlyUsd,
        nowDate.getTime(),
      );
      if (!check.ok) throw new VastGuardrailError(`Confirmation required: ${check.reason}`);
      if (!input.registerSecret) {
        throw new VastGuardrailError("AURORA_REGISTER_SECRET is not configured — worker could never register.");
      }

      // Re-fetch the offer NOW — a token only proves the caller approved a
      // price at search time; the live price must still be under both the
      // ceiling and the confirmed price at rental time.
      const offer = await vast.getOfferById(input.offerId);
      if (!offer) {
        throw new VastGuardrailError(`Offer ${input.offerId} is no longer available. Run \`aurora vast search\` again.`);
      }
      const PRICE_EPS = 0.0001;
      if (offer.dph_total > VAST_MAX_HOURLY_USD + PRICE_EPS || offer.dph_total > input.hourlyUsd + PRICE_EPS) {
        throw new VastGuardrailError(
          `Offer ${input.offerId} now costs $${offer.dph_total}/hr — above the confirmed $${input.hourlyUsd}/hr` +
            ` (ceiling $${VAST_MAX_HOURLY_USD}/hr). Nothing was rented. Run \`aurora vast search\` again.`,
        );
      }

      // Reserve BEFORE renting: insert the managed row first with a unique
      // placeholder id. The partial unique index (one active non-adopted row)
      // makes concurrent provisions collide here — before any money is spent —
      // and guarantees the expiry cron always has a row to reconcile even if
      // we crash between the Vast create and the id update.
      const tasks = (input.tasks ?? "lipsync,assemble").trim();
      const deadline = new Date(nowDate.getTime() + VAST_MAX_RUNTIME_MS);
      const placeholderId = -Math.abs(Math.floor(Math.random() * 2 ** 48) + 1);
      let reservation: ManagedInstanceRow;
      try {
        reservation = await repo.insert({
          vast_instance_id: placeholderId,
          label: "pending", // replaced below once the row id is known
          gpu_name: offer.gpu_name,
          hourly_usd: offer.dph_total,
          adopted: false,
          endpoint_url: null,
          worker_id: null,
          state: "renting",
          failure_reason: null,
          created_by: input.userId,
          destroy_deadline: deadline.toISOString(),
          destroyed_at: null,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/unique|duplicate|vast_managed_one_active_rental/i.test(msg)) {
          throw new VastGuardrailError(
            "An Aurora-managed rental is already active (or being provisioned). Destroy it first: aurora vast status / aurora vast destroy <id>",
          );
        }
        throw e;
      }

      // Unique per-rental label lets the expiry cron find and destroy the
      // instance even if we crash before recording the real instance id.
      const name = (input.name ?? `vast-cli-${nowDate.toISOString().slice(0, 10)}`).trim();
      const label = `aurora-${reservation.id}`;
      const bootstrapUrl = `${appUrl}/api/public/workers/files/vast_bootstrap.py`;

      let instanceId: number;
      try {
        ({ instanceId } = await vast.createInstance(input.offerId, {
          image: "pytorch/pytorch:2.3.1-cuda12.1-cudnn8-runtime",
          env: {
            AURORA_URL: appUrl,
            AURORA_REGISTER_SECRET: input.registerSecret,
            AURORA_TASKS: tasks,
            AURORA_WORKER_NAME: name,
          },
          ports: [8000], // worker HTTP endpoint
          onstartCmd: `curl -fsSL ${bootstrapUrl} -o /workspace/vast_bootstrap.py && python3 /workspace/vast_bootstrap.py`,
          diskGb: 40,
          label,
        }));
      } catch (e) {
        // Nothing was rented — release the reservation and surface the error.
        await repo
          .update(reservation.id, {
            state: "failed",
            failure_reason: `Vast create failed: ${e instanceof Error ? e.message : String(e)}`,
          })
          .catch(() => {});
        throw e;
      }

      try {
        await repo.update(reservation.id, { vast_instance_id: instanceId, label });
      } catch (e) {
        // Rented but couldn't record the real id → compensate by destroying
        // the instance immediately; the reservation row is marked failed. If
        // even the destroy fails, the row (with its label) lets the expiry
        // cron reconcile-by-label and finish the destroy.
        const persistErr = e instanceof Error ? e.message : String(e);
        try {
          await vast.destroyInstance(instanceId);
          await repo
            .update(reservation.id, {
              state: "failed",
              destroyed_at: now().toISOString(),
              failure_reason: `persistence failed after create; instance ${instanceId} destroyed (${persistErr})`,
            })
            .catch(() => {});
        } catch {
          // Leave the row active — expiry cron retries via label reconciliation.
        }
        throw new VastGuardrailError(
          `Rented instance ${instanceId} but failed to record it (${persistErr}); it was destroyed to avoid unbilled-for tracking. Nothing is running.`,
        );
      }

      return { ...reservation, vast_instance_id: instanceId, label, gpu_name: offer.gpu_name, hourly_usd: offer.dph_total };
    },

    /** Adopt an ALREADY-rented instance on the owner's Vast account so Aurora
     *  can monitor and auto-destroy it. Idempotent: re-adopting returns the
     *  existing record. */
    async adopt(vastInstanceId: number, userId: string): Promise<ManagedInstanceRow> {
      const existing = await repo.getByVastId(vastInstanceId);
      if (existing && existing.state !== "destroyed" && existing.state !== "expired") return existing;

      const inst = await vast.getInstance(vastInstanceId);
      if (!inst) {
        throw new VastGuardrailError(
          `Vast instance ${vastInstanceId} was not found on your account. Aurora can only adopt instances the configured VASTAI_API_KEY owns.`,
        );
      }
      const deadline = new Date(now().getTime() + VAST_MAX_RUNTIME_MS);
      return repo.insert({
        vast_instance_id: vastInstanceId,
        label: inst.label ?? `vast-adopted-${vastInstanceId}`,
        gpu_name: inst.gpu_name,
        hourly_usd: inst.dph_total ?? 0,
        adopted: true,
        endpoint_url: endpointFromInstance(inst),
        worker_id: null,
        state: inst.actual_status === "running" ? "running" : "renting",
        failure_reason: null,
        created_by: userId,
        destroy_deadline: deadline.toISOString(),
        destroyed_at: null,
      });
    },

    /** Live status for managed instances: DB row + fresh Vast state + linked worker. */
    async status(): Promise<Array<ManagedInstanceRow & { live: VastInstance | null }>> {
      const rows = await repo.listRecent(20);
      const active = rows.filter((r) => r.state === "renting" || r.state === "running" || r.state === "stopped");
      const liveById = new Map<number, VastInstance>();
      if (active.length > 0) {
        const instances = await vast.listInstances().catch(() => [] as VastInstance[]);
        for (const inst of instances) liveById.set(inst.id, inst);
      }
      const out: Array<ManagedInstanceRow & { live: VastInstance | null }> = [];
      for (const row of rows) {
        const live = liveById.get(row.vast_instance_id) ?? null;
        // Reconcile cheap state transitions while we're here.
        if (live && row.state === "renting" && live.actual_status === "running") {
          const endpoint = endpointFromInstance(live);
          await repo.update(row.id, {
            state: "running",
            gpu_name: live.gpu_name ?? row.gpu_name,
            ...(endpoint ? { endpoint_url: endpoint } : {}),
          });
          out.push({ ...row, state: "running", gpu_name: live.gpu_name ?? row.gpu_name, endpoint_url: endpoint ?? row.endpoint_url, live });
          continue;
        }
        out.push({ ...row, live });
      }
      return out;
    },

    /** Stop a managed instance (still accrues storage cost on Vast; destroy to fully stop billing). */
    async stop(idOrVastId: string): Promise<ManagedInstanceRow> {
      const row = await requireManaged(idOrVastId);
      if (row.state === "destroyed" || row.state === "expired") return row; // idempotent no-op
      await vast.stopInstance(row.vast_instance_id);
      await repo.update(row.id, { state: "stopped" });
      return { ...row, state: "stopped" };
    },

    /** Destroy a managed instance. Idempotent — safe to retry. */
    async destroy(idOrVastId: string, reason?: string): Promise<ManagedInstanceRow> {
      const row = await requireManaged(idOrVastId);
      if (row.state === "destroyed" || row.state === "expired") return row; // already gone
      await vast.destroyInstance(row.vast_instance_id); // 404 handled inside (idempotent)
      await repo.update(row.id, {
        state: "destroyed",
        destroyed_at: now().toISOString(),
        ...(reason ? { failure_reason: reason } : {}),
      });
      return { ...row, state: "destroyed" };
    },

    /** Cron: destroy every managed instance past its deadline. Retry-safe —
     *  each expiry is independent, failures are recorded and retried next run. */
    async expireOverdue(): Promise<{ expired: number[]; failed: Array<{ vastId: number; error: string }> }> {
      const nowMs = now().getTime();
      const active = await repo.listActive();
      const overdue = active.filter((r) => new Date(r.destroy_deadline).getTime() <= nowMs);
      const expired: number[] = [];
      const failed: Array<{ vastId: number; error: string }> = [];
      for (const row of overdue) {
        try {
          if (row.vast_instance_id < 0) {
            // Orphaned reservation (crashed between Vast create and id update):
            // reconcile by the unique per-rental label. If a live instance
            // carries this row's label, destroy it; otherwise nothing was ever
            // rented and the row is just closed out.
            const live = (await vast.listInstances()).find((i) => i.label === `aurora-${row.id}`);
            if (live) await vast.destroyInstance(live.id);
            await repo.update(row.id, {
              state: "expired",
              destroyed_at: now().toISOString(),
              failure_reason: live
                ? `orphaned rental ${live.id} reconciled by label and destroyed`
                : "reservation never materialized into a rental",
            });
            expired.push(row.vast_instance_id);
            continue;
          }
          await vast.destroyInstance(row.vast_instance_id);
          await repo.update(row.id, {
            state: "expired",
            destroyed_at: now().toISOString(),
            failure_reason: "auto-destroyed at 1-hour deadline",
          });
          expired.push(row.vast_instance_id);
        } catch (e) {
          // Leave the row active so the next sweep retries the destroy.
          failed.push({ vastId: row.vast_instance_id, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return { expired, failed };
    },
  };
}

export type VastLifecycle = ReturnType<typeof createVastLifecycle>;
