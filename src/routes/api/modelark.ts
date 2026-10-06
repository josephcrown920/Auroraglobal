import { createFileRoute } from "@tanstack/react-router";
import { modelArkListModels, modelArkResponses } from "@/lib/modelark.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ModelArkBody = {
  action?: "chat" | "models";
  model?: string;
  messages?: unknown[];
  input?: unknown;
  tools?: unknown[];
  previous_response_id?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authorized(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization") || "";
  const trustedToken = process.env.AURORA_MCP_TOKEN?.trim();
  if (trustedToken && auth === `Bearer ${trustedToken}`) return true;

  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return !error && !!data.user;
}

export const Route = createFileRoute("/api/modelark")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await authorized(request))) return json({ error: { message: "Unauthorized" } }, 401);

        const body = (await request.json().catch(() => ({}))) as ModelArkBody;
        try {
          if (body.action === "models") return json(await modelArkListModels());

          const input =
            body.input ??
            (Array.isArray(body.messages) && body.messages.length ? body.messages : undefined);
          if (input === undefined) return json({ error: { message: "Provide input or messages." } }, 400);

          return json(await modelArkResponses({
            model: body.model,
            input,
            tools: body.tools,
            previousResponseId: body.previous_response_id,
          }));
        } catch (error) {
          return json({ error: { message: error instanceof Error ? error.message : String(error) } }, 502);
        }
      },
    },
  },
});