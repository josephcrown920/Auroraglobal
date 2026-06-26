// Aurora MCP endpoint — POST /api/mcp
// A stateless Model Context Protocol "Streamable HTTP" server implemented as a
// plain JSON-RPC handler (no @modelcontextprotocol/sdk, which is Node-only and
// won't run on Cloudflare Workers). Discovery (initialize / tools/list / ping)
// is open; tools/call requires a Bearer token (Supabase JWT or aurk_ API key),
// the same auth used by /api/public/generate.
//
// Configure in an MCP client (e.g. Claude) as a remote/HTTP MCP server pointing
// at https://<your-domain>/api/mcp with an Authorization: Bearer <token> header.

import { createFileRoute } from "@tanstack/react-router";
import { listTools, callTool } from "@/lib/mcp/server.server";

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = { name: "aurora-mcp", version: "1.0.0" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

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

type RpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };
type Auth = { userId: string | null; bearer: string | null };

function result(id: RpcMessage["id"], r: unknown) {
  return { jsonrpc: "2.0", id, result: r };
}
function error(id: RpcMessage["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleMessage(msg: RpcMessage, auth: Auth, origin: string): Promise<object | null> {
  const { method, id, params } = msg;
  switch (method) {
    case "initialize":
      return result(id, {
        protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "notifications/initialized":
    case "initialized":
      return null; // notification — no response
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, listTools());
    case "tools/call": {
      if (!auth.userId || !auth.bearer) {
        return error(id, -32001, "Unauthorized: provide Authorization: Bearer <Supabase JWT or aurk_ API key>");
      }
      const name = params?.name as string;
      const args = params?.arguments ?? {};
      try {
        const toolResult = await callTool(name, args, { userId: auth.userId, bearer: auth.bearer, origin });
        return result(id, toolResult);
      } catch (e) {
        // Surface tool/validation failures as an MCP tool error result, not a transport error.
        const text = JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
        return result(id, { content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      if (id === undefined || id === null) return null; // unknown notification
      return error(id, -32601, `Method not found: ${method}`);
  }
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
        const origin = new URL(request.url).origin;
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify(error(null, -32700, "Parse error")), { status: 200, headers: JSON_HEADERS });
        }
        const auth = await authUserId(request);
        const isBatch = Array.isArray(body);
        const messages = (isBatch ? body : [body]) as RpcMessage[];

        const responses: object[] = [];
        for (const m of messages) {
          const r = await handleMessage(m, auth, origin);
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
