// Aurora AI Intelligence Router — Decision Logger
// Writes each routing decision to `ai_router_logs` in Supabase.
// If the table is missing (dev without migration applied), logs to console only.

import type { RequestCategory } from "./categories";

export type RouterLogEntry = {
  category: RequestCategory;
  provider_used: string;
  fallback_count: number;
  latency_ms: number;
  success: boolean;
  failure_reason: string | null;
  estimated_cost: number;
};

// Narrow cast for tables not yet in generated Supabase types.
type LogsTable = {
  insert: (row: RouterLogEntry & { created_at: string }) => Promise<{ error: { message: string } | null }>;
};

let _adminClient: unknown = null;

async function getAdmin() {
  if (_adminClient) return _adminClient;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    _adminClient = supabaseAdmin;
  } catch {
    // client.server is not available in all environments
    _adminClient = null;
  }
  return _adminClient;
}

export async function logRouterDecision(entry: RouterLogEntry): Promise<void> {
  const admin = await getAdmin();
  if (!admin) {
    console.log("[ai-router]", JSON.stringify(entry));
    return;
  }

  try {
    const client = (admin as { from: (table: string) => LogsTable }).from("ai_router_logs");
    const { error } = await client.insert({
      ...entry,
      created_at: new Date().toISOString(),
    });
    if (error) {
      // Table likely not migrated yet — fall back to console silently.
      if (error.message?.includes("relation") || error.message?.includes("does not exist")) {
        console.log("[ai-router]", JSON.stringify(entry));
      } else {
        console.warn("[ai-router] log write failed:", error.message);
      }
    }
  } catch {
    // Never let a logging failure surface to the caller.
    console.log("[ai-router]", JSON.stringify(entry));
  }
}
