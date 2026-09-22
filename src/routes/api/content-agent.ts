import { createFileRoute } from "@tanstack/react-router";
import { modelArkResponses, modelArkText, modelArkTextModel } from "@/lib/modelark.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ContentBody = {
  brief?: string;
  referenceAssetUrls?: string[];
  platforms?: string[];
  count?: number;
  aspectRatio?: "9:16" | "1:1" | "16:9";
};

const tools = [
  {
    type: "function",
    name: "create_content_plan",
    description: "Create a structured social content plan from a creative brief. Do not generate media; return concepts, hooks, shots, captions and production instructions.",
    parameters: {
      type: "object",
      properties: { concepts: { type: "array", items: { type: "object" } }, notes: { type: "string" } },
      required: ["concepts"],
    },
  },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function authorized(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization") || "";
  const trustedToken = process.env.AURORA_MCP_TOKEN?.trim();
  if (trustedToken && auth === `Bearer ${trustedToken}`) return true;
  if (!auth.startsWith("Bearer ")) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(auth.slice(7));
  return !error && !!data.user;
}

export const Route = createFileRoute("/api/content-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await authorized(request))) return json({ error: { message: "Unauthorized" } }, 401);
        const body = (await request.json().catch(() => ({}))) as ContentBody;
        const brief = body.brief?.trim();
        if (!brief) return json({ error: { message: "brief is required." } }, 400);

        const count = Math.min(Math.max(body.count || 5, 1), 20);
        const platforms = body.platforms?.length ? body.platforms : ["TikTok", "Instagram Reels", "YouTube Shorts"];
        const aspectRatio = body.aspectRatio || "9:16";
        const prompt = [
          "You are Aurora's creative director and content-production planner.",
          `Create ${count} distinct concepts for: ${platforms.join(", ")}.`,
          `Default aspect ratio: ${aspectRatio}.`,
          body.referenceAssetUrls?.length
            ? `Reference assets are supplied: ${body.referenceAssetUrls.join(", ")}. Preserve subject continuity and treat them as references, not prompt text.`
            : "",
          "For every concept return a hook, concept, shot list, exact media prompts, caption, CTA, platform, aspect ratio, suggested duration, and edit notes.",
          "Do not invent unavailable model capabilities. Keep generation instructions provider-neutral.",
          brief,
        ].filter(Boolean).join("\n\n");

        try {
          const response = await modelArkResponses({
            model: modelArkTextModel(),
            input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
            tools,
          });
          return json({ ok: true, model: modelArkTextModel(), count, platforms, aspectRatio, text: modelArkText(response), response });
        } catch (error) {
          return json({ error: { message: error instanceof Error ? error.message : String(error) } }, 502);
        }
      },
    },
  },
});