// Admin-only server functions for Aurora-managed Vast.ai instance visibility
// (Admin → Orchestration). Lifecycle mutations stay on the CLI control route
// (/api/public/cli/vast); this is read-only dashboard data.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { assertAdmin } from "@/lib/admin.functions";

export type VastManagedView = {
  id: string;
  vast_instance_id: number;
  label: string;
  gpu_name: string | null;
  hourly_usd: number;
  adopted: boolean;
  endpoint_url: string | null;
  state: string;
  failure_reason: string | null;
  created_at: string;
  destroy_deadline: string;
  destroyed_at: string | null;
  worker: { name: string; status: string } | null;
};

export const listVastManaged = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }): Promise<{ configured: boolean; instances: VastManagedView[] }> => {
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!roles?.some((r) => r.role === "admin")) throw new Error("Forbidden");

    // vast_managed_instances is service-role-only and absent from generated types.
    const db = supabaseAdmin as unknown as {
      from(t: string): {
        select(c: string): {
          order(c: string, o: { ascending: boolean }): {
            limit(n: number): Promise<{ data: unknown; error: { message: string } | null }>;
          };
        };
      };
    };
    const { data, error } = await db
      .from("vast_managed_instances")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(`vast_managed_instances: ${error.message}`);
    const rows = (data ?? []) as Array<Omit<VastManagedView, "worker">>;

    const { data: workers } = await supabaseAdmin
      .from("gpu_workers")
      .select("name, status, endpoint_url")
      .eq("protocol", "vast");

    return {
      configured: Boolean(process.env.VASTAI_API_KEY),
      instances: rows.map((r) => ({
        ...r,
        worker:
          (workers ?? []).find((w) => r.endpoint_url && w.endpoint_url.startsWith(r.endpoint_url)) ?? null,
      })),
    };
  },
);

export const getMotionAutoscaleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { liveMotionAutoscaler } = await import("./motion-autoscaler-live.server");
    return liveMotionAutoscaler().status();
  });

// This is an intentional operator opt-in only. It carries no offer, endpoint,
// price, or arbitrary configuration from the browser, and does not clear a
// cooldown: disabling and re-enabling cannot turn an outage into spend retries.
export const setMotionAutoscaleEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const db = supabaseAdmin as unknown as {
      from(t: string): {
        update(patch: Record<string, unknown>): { eq(c: string, value: boolean): Promise<{ error: { message: string } | null }> };
      };
    };
    const { error } = await db
      .from("motion_autoscale_state")
      .update({ enabled: data.enabled, updated_at: new Date().toISOString() })
      .eq("singleton", true);
    if (error) throw new Error(`motion autoscale policy: ${error.message}`);
    return { ok: true, enabled: data.enabled };
  });
