// Task #374 — API observability.
//
// Every request that reaches src/routes/api/** is logged to the `api_logs`
// table (see the matching migration) for the Admin → Observability
// dashboard. Rather than sprinkling a call into each of the 50+ route
// files under src/routes/api/** (per-route boilerplate that is easy to
// forget on the next new route), this is wired ONCE at the single shared
// entry point every request already passes through: the top-level
// `fetch` handler in src/server.ts. That guarantees complete coverage
// (including future routes) with one call site.
//
// logApiRequest() must never throw or delay the response — an observability
// write can never be allowed to break or slow down the actual request it is
// describing. It returns the write promise (rather than fire-and-forgetting
// internally) so the caller can hand it to the runtime's `ctx.waitUntil`
// where available (see keepAlive() in src/server.ts) — some deploy targets
// terminate the isolate right after `fetch` resolves, which would otherwise
// silently drop the insert.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BOT_USER_AGENT_KEYWORDS = [
  "bot",
  "spider",
  "crawl",
  "curl",
  "python-requests",
  "go-http",
  "datadog",
  "kube-probe",
];

// Endpoints hit exclusively by our own scheduler (pg_cron → apikey header),
// never by a real visitor or a search-engine bot.
const INTERNAL_ENDPOINTS = new Set([
  "/api/public/jobs/tick",
  "/api/public/workers/health",
]);

function isLoopbackIp(ip: string | null): boolean {
  if (!ip) return false;
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export function extractRequestIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // The first entry is the original client; later entries are
    // intermediate proxies (Cloudflare, the dev-server tunnel, etc.).
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

export type ApiLogSource = "real" | "bot" | "internal";

export function classifyApiLogSource(params: {
  endpoint: string;
  ip: string | null;
  userAgent: string | null;
}): ApiLogSource {
  const { endpoint, ip, userAgent } = params;
  if (INTERNAL_ENDPOINTS.has(endpoint) || isLoopbackIp(ip)) return "internal";

  const ua = (userAgent ?? "").toLowerCase();
  if (ua && BOT_USER_AGENT_KEYWORDS.some((keyword) => ua.includes(keyword))) {
    return "bot";
  }
  return "real";
}

export async function logApiRequest(params: {
  endpoint: string;
  method: string;
  status: number;
  responseTimeMs: number;
  request: Request;
}): Promise<void> {
  try {
    const { endpoint, method, status, responseTimeMs, request } = params;
    const ip = extractRequestIp(request);
    const userAgent = request.headers.get("user-agent");
    const source = classifyApiLogSource({ endpoint, ip, userAgent });

    const { error } = await supabaseAdmin.from("api_logs").insert({
      endpoint,
      method,
      status,
      response_time_ms: Math.max(0, Math.round(responseTimeMs)),
      ip,
      user_agent: userAgent,
      source,
    });
    if (error) {
      console.error("[api-logger] failed to record api_logs row:", error);
    }
  } catch (error) {
    // Never let observability logging break or delay the real request.
    console.error("[api-logger] unexpected error:", error);
  }
}
