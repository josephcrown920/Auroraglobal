import { createFileRoute } from "@tanstack/react-router";
import { experimental_generateImage as generateImage } from "ai";

const MODEL = "prodia/flux-fast-schnell";

export const Route = createFileRoute("/api/ai-gateway/flux-schnell")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.AI_GATEWAY_API_KEY) {
          return new Response("AI_GATEWAY_API_KEY is not configured", { status: 503 });
        }

        const body = (await request.json().catch(() => ({}))) as { prompt?: string };
        if (!body.prompt?.trim()) return new Response("Prompt required", { status: 400 });

        const result = await generateImage({
          model: MODEL,
          prompt: body.prompt,
        });

        return Response.json({
          model: MODEL,
          images: result.images,
        });
      },
    },
  },
});
