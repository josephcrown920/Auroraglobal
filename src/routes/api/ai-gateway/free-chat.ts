import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";
import { FREE_AI_MODELS } from "@/lib/ai-gateway-free-models";

const ALLOWED = new Set(
  FREE_AI_MODELS.filter(
    (model) => model.free && (model.modality === "chat" || model.modality === "reasoning" || model.modality === "vision"),
  ).map((model) => model.id),
);

type Body = {
  model?: string;
  prompt?: string;
  system?: string;
};

export const Route = createFileRoute("/api/ai-gateway/free-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!process.env.AI_GATEWAY_API_KEY) {
          return new Response("AI_GATEWAY_API_KEY is not configured", { status: 503 });
        }

        const body = (await request.json().catch(() => ({}))) as Body;
        const model = body.model?.trim() || "poolside/laguna-s-2.1-free";
        if (!ALLOWED.has(model)) return new Response("Unsupported free model", { status: 400 });
        if (!body.prompt?.trim()) return new Response("Prompt required", { status: 400 });

        const result = streamText({
          model,
          system: body.system?.trim() || "You are an Aurora AI assistant.",
          prompt: body.prompt,
        });

        return result.toTextStreamResponse();
      },
    },
  },
});
