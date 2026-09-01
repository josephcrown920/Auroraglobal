// Aurora AI Intelligence Router — Decision Logger
// Writes each routing decision to `ai_router_logs` in Supabase.
// Logging is best-effort and must never make an AI request fail.

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
let _adminUnavailable = false;

async function getAdmin() {
  if (_adminClient || _adminUnavailable) return _adminClient;

  // CI, local unit tests, and provider-isolation tests legitimately run without
  // server Supabase credentials. Do not touch the lazy admin proxy in that case:
  // merely reading a property on the proxy would throw before its caller can
  // handle the optional logging path.
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    _adminUnavailable = true;
    return null;
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    _adminClient = supabaseAdmin;
  } catch {
    _adminUnavailable = true;
    return null;
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
