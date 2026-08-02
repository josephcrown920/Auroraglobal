// Aurora AI Intelligence Router — Admin server functions
// These are admin-only endpoints used by the RouterPanel in admin.lazy.tsx.
// Health data comes from the in-memory tracker (process-scoped).
// Log data comes from the `ai_router_logs` Supabase table.

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdmin } from "@/lib/admin.server";
import { getDegradedCategories, getHealthSnapshot } from "@/lib/ai-router/health";
import { REQUEST_CATEGORIES } from "@/lib/ai-router/categories";
import { getProviderRegistry } from "@/lib/ai-router/providers";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RouterHealthRow = {
  name: string;
  displayName?: string;
  enabled: boolean;
  healthy: boolean;
  callsInWindow: number;
  successRate: number | null;
  avgLatencyMs: number | null;
};

export type RouterHealthData = {
  providers: RouterHealthRow[];
  degradedCategories: string[];
};

export type RouterLogRow = {
  id: string;
  category: string;
  provider_used: string;
  fallback_count: number;
  latency_ms: number;
  success: boolean;
  failure_reason: string | null;
  estimated_cost: number;
  created_at: string;
};

/** Returns current in-memory health state for all registered providers. */
export const getRouterHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Admin access required");

    const registry = getProviderRegistry();
    const allProviders = [...registry.values()].map((p) => ({
      name: p.name,
      displayName: p.displayName,
      enabled: p.enabled,
    }));

    const providers = getHealthSnapshot(allProviders) as RouterHealthRow[];
    const enabledNames = new Set(providers.filter((p) => p.enabled).map((p) => p.name));
    const degradedCategories = getDegradedCategories(REQUEST_CATEGORIES, enabledNames);

    return { providers, degradedCategories };
  });

/** Returns the 50 most recent AI router log entries from the database. */
export const getRouterLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Admin access required");

    try {
      const client = supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            order: (col: string, opts: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: RouterLogRow[] | null; error: { message: string } | null }>;
            };
          };
        };
      };

      const { data, error } = await client
        .from("ai_router_logs")
        .select("id, category, provider_used, fallback_count, latency_ms, success, failure_reason, estimated_cost, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        // Table not migrated yet — return empty list gracefully.
        return { logs: [] as RouterLogRow[], migrationPending: true };
      }
      return { logs: data ?? [], migrationPending: false };
    } catch {
      return { logs: [] as RouterLogRow[], migrationPending: true };
    }
  });
