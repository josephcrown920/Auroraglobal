// Aurora MCP endpoint — POST /api/mcp
// A stateless Model Context Protocol "Streamable HTTP" server implemented as a
// plain JSON-RPC handler (no @modelcontextprotocol/sdk, which is Node-only and
// won't run on Cloudflare Workers). Discovery (initialize / tools/list / ping)
// is open; tools/call requires a Bearer token (Supabase JWT or aurk_ API key),
// the same auth used by /api/public/generate. The JSON-RPC message handler lives
// in src/lib/mcp/server.server.ts so it can be unit-tested without route plumbing.
//
// Configure in a Bearer-token MCP client (e.g. Claude Desktop / Cursor) as a
// remote/HTTP MCP server pointing at https://<your-domain>/api/mcp with an
// Authorization: Bearer <token> header.

import { createFileRoute } from "@tanstack/react-router";
import { handleRpcMessage, SERVER_INFO, type RpcMessage } from "@/lib/mcp/server.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

// Sync tools (generate_video, image_to_video) self-call /api/public/generate
// forwarding the caller's Bearer token, so the origin MUST resolve to our own
// trusted host — never a Host/proxy-influenced request origin (that would leak
// the caller's credential to an attacker-controlled domain). Prefer the
// configured SITE_URL (same env billing uses); fall back to the request origin
// only when it is unset (local dev).
function resolveSelfOrigin(request: Request): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

async function authUserId(req: Request): Promise<{ userId: string | null; bearer: string | null }> {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return { userId: null, bearer: null };
  const token = h.slice(7);
  if (token.startsWith("aurk_")) {
    const { userIdForApiKey } = await import("@/lib/cli-device.server");
    return { userId: await userIdForApiKey(token), bearer: token };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return { userId: null, bearer: token };
  return { userId: data.user.id, bearer: token };
}

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () =>
        new Response(
          JSON.stringify({ ...SERVER_INFO, transport: "streamable-http", endpoint: "/api/mcp" }),
          { status: 200, headers: JSON_HEADERS },
        ),
      POST: async ({ request }) => {
        const origin = resolveSelfOrigin(request);
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }),
            { status: 200, headers: JSON_HEADERS },
          );
        }
        const auth = await authUserId(request);
        const isBatch = Array.isArray(body);
        const messages = (isBatch ? body : [body]) as RpcMessage[];

        const responses: object[] = [];
        for (const m of messages) {
          const r = await handleRpcMessage(m, auth, origin);
          if (r) responses.push(r);
        }
        if (responses.length === 0) {
          return new Response(null, { status: 202, headers: CORS }); // only notifications
        }
        const payload = isBatch ? responses : responses[0];
        return new Response(JSON.stringify(payload), { status: 200, headers: JSON_HEADERS });
      },
    },
  },
});
