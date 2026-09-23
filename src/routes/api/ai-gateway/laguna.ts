// POST /api/ai-gateway/laguna
// Vercel AI Gateway -> Poolside Laguna S 2.1 Free.
// Requires the server-side AI_GATEWAY_API_KEY environment variable.
import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";

const MODEL = "poolside/laguna-s-2.1-free";

type Body = {
  prompt?: string;
  system?: string;
};

export const Route = createFileRoute("/api/ai-gateway/laguna")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.AI_GATEWAY_API_KEY) {
          return new Response("AI_GATEWAY_API_KEY is not configured", { status: 503 });
        }

        const body = (await request.json().catch(() => ({}))) as Body;
        if (!body.prompt?.trim()) {
          return new Response("Prompt required", { status: 400 });
        }

        const result = streamText({
          model: MODEL,
          system: body.system?.trim() || "You are Aurora's coding and technical reasoning agent.",
          prompt: body.prompt,
        });

        return result.toTextStreamResponse();
      },
    },
  },
});
