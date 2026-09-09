// Production Supabase wiring for the pure motion autoscaler controller.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  createMotionAutoscaler,
  type MotionAutoscaleRepo,
  type MotionAutoscaleState,
  type MotionAutoscaleWorker,
} from "./motion-autoscaler.server";
import { liveVastLifecycle } from "./vast-lifecycle-live.server";
import type { ManagedInstanceRow } from "./vast-lifecycle.server";

const STATE_TABLE = "motion_autoscale_state";
const ACTIVE_MOTION_STATUSES = ["queued", "pending", "processing", "finalizing"];
const SCHEMA_PENDING_STATE: MotionAutoscaleState = {
  enabled: false,
  cooldown_until: null,
  failure_count: 0,
  failure_reason: "Motion autoscaling is disabled until its database migration is applied",
  decision_lease_until: null,
  last_activity_at: null,
  last_decision_at: null,
  last_decision_action: null,
  last_decision_provider: null,
  last_decision_reason: "Schema migration pending",
};

type LooseDb = {
  // The autoscaler intentionally queries a migration-gated table that is not
  // present in every generated client schema.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
  rpc(name: string, params?: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
};
const db = supabaseAdmin as unknown as LooseDb;

function required<T>(data: T | null, error: { message: string } | null, operation: string): T {
  if (error) throw new Error(`motion autoscale ${operation}: ${error.message}`);
  if (!data) throw new Error(`motion autoscale ${operation}: no row returned`);
  return data;
}

export const liveMotionAutoscaleRepo: MotionAutoscaleRepo = {
  async getState() {
    const query = db.from(STATE_TABLE) as {
      select(columns: string): {
        eq(column: string, value: unknown): {
          maybeSingle(): Promise<{ data: MotionAutoscaleState | null; error: { message: string } | null }>;
        };
      };
    };
    const { data, error } = await query.select("*").eq("singleton", true).maybeSingle();
    // Development and deployments can receive application code before the
    // companion migration. Capacity must fail closed—not throw from cron or
    // accidentally become enabled—until the singleton policy row exists.
    if (error && /relation .*motion_autoscale_state.* does not exist|could not find the table/i.test(error.message)) {
      return SCHEMA_PENDING_STATE;
    }
    return required(data as MotionAutoscaleState | null, error, "get state");
  },
  async patchState(patch) {
    const { error } = await db
      .from(STATE_TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("singleton", true);
    if (error) throw new Error(`motion autoscale update: ${error.message}`);
  },
  async claimDecision(action, provider) {
    const { data, error } = await db.rpc("claim_motion_autoscale_decision", {
      _action: action,
      _provider: provider,
    });
    if (error) throw new Error(`motion autoscale claim: ${error.message}`);
    return data === true;
  },
  async listMotionJobs() {
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("status")
      .eq("kind", "motion")
      .in("status", ACTIVE_MOTION_STATUSES)
      .limit(200);
    if (error) throw new Error(`motion autoscale jobs: ${error.message}`);
    return data ?? [];
  },
  async listMotionWorkers() {
    const { data, error } = await supabaseAdmin
      .from("gpu_workers")
      .select("id, name, endpoint_url, auth_token, protocol, capabilities, status, in_flight, max_concurrency, last_heartbeat")
      .contains("capabilities", ["motion"])
      .limit(50);
    if (error) throw new Error(`motion autoscale workers: ${error.message}`);
    return (data ?? []).filter((worker) => typeof worker.endpoint_url === "string") as unknown as MotionAutoscaleWorker[];
  },
  async listManagedVast() {
    const { data, error } = await db
      .from("vast_managed_instances")
      .select("*")
      .in("state", ["renting", "running", "stopped"]);
    if (error) throw new Error(`motion autoscale managed Vast: ${error.message}`);
    return (data ?? []) as ManagedInstanceRow[];
  },
};

export function liveMotionAutoscaler() {
  return createMotionAutoscaler({
    repo: liveMotionAutoscaleRepo,
    lifecycle: liveVastLifecycle(),
    runpod: {
      endpointId: process.env.RUNPOD_ENDPOINT_ID,
      apiKey: process.env.RUNPOD_API_KEY,
    },
  });
}