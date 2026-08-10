// Production wiring for the Vast lifecycle service: Supabase-backed repo +
// real Vast API client + env-derived config. Routes import THIS; tests import
// the pure service from vast-lifecycle.server.ts with fakes.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createVastClient } from "@/lib/vast-api.server";
import {
  createVastLifecycle,
  type ManagedInstanceRow,
  type ManagedRepo,
  type VastLifecycle,
} from "@/lib/vast-lifecycle.server";
import { SITE_URL } from "@/lib/site-url";

// vast_managed_instances is service-role-only and not in the generated types.
type Untyped = {
  from(table: string): {
    select(cols: string): {
      eq(col: string, v: unknown): { maybeSingle(): Promise<{ data: unknown; error: { message: string } | null }> };
      in(col: string, v: unknown[]): Promise<{ data: unknown; error: { message: string } | null }>;
      order(col: string, o: { ascending: boolean }): {
        limit(n: number): Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
    insert(row: Record<string, unknown>): {
      select(cols: string): { single(): Promise<{ data: unknown; error: { message: string } | null }> };
    };
    update(patch: Record<string, unknown>): {
      eq(col: string, v: unknown): Promise<{ error: { message: string } | null }>;
    };
  };
};

const db = supabaseAdmin as unknown as Untyped;
const TABLE = "vast_managed_instances";

function must<T>(data: T | null, error: { message: string } | null, op: string): T {
  if (error) throw new Error(`vast_managed_instances ${op}: ${error.message}`);
  if (data == null) throw new Error(`vast_managed_instances ${op}: no row returned`);
  return data;
}

export const supabaseManagedRepo: ManagedRepo = {
  async getByVastId(vastId) {
    const { data, error } = await db.from(TABLE).select("*").eq("vast_instance_id", vastId).maybeSingle();
    if (error) throw new Error(`vast_managed_instances getByVastId: ${error.message}`);
    return (data as ManagedInstanceRow) ?? null;
  },
  async get(id) {
    const { data, error } = await db.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`vast_managed_instances get: ${error.message}`);
    return (data as ManagedInstanceRow) ?? null;
  },
  async insert(row) {
    const { data, error } = await db.from(TABLE).insert(row).select("*").single();
    return must(data, error, "insert") as ManagedInstanceRow;
  },
  async update(id, patch) {
    const { error } = await db
      .from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(`vast_managed_instances update: ${error.message}`);
  },
  async listActive() {
    const { data, error } = await db.from(TABLE).select("*").in("state", ["renting", "running", "stopped"]);
    if (error) throw new Error(`vast_managed_instances listActive: ${error.message}`);
    return (data as ManagedInstanceRow[]) ?? [];
  },
  async listRecent(limit) {
    const { data, error } = await db.from(TABLE).select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error(`vast_managed_instances listRecent: ${error.message}`);
    return (data as ManagedInstanceRow[]) ?? [];
  },
};

export function liveVastLifecycle(): VastLifecycle {
  const confirmSecret = process.env.SESSION_SECRET;
  if (!confirmSecret) throw new Error("SESSION_SECRET is not configured (needed for Vast confirm tokens).");
  return createVastLifecycle({
    vast: createVastClient(),
    repo: supabaseManagedRepo,
    now: () => new Date(),
    confirmSecret,
    appUrl: SITE_URL,
  });
}
