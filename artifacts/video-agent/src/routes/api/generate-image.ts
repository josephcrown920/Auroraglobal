import { createFileRoute } from "@tanstack/react-router";

// Uses Replit's managed OpenAI proxy (AI_INTEGRATIONS_OPENAI_*) instead of the
// Lovable AI Gateway — no LOVABLE_API_KEY required.
// gpt-image-1 with stream:true emits the same SSE event format that
// streamImage.ts already knows how to parse:
//   event: image_generation.partial_image  → progressive b64 chunk
//   event: image_generation.completed      → final b64 frame

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { prompt } = (await request.json()) as { prompt: string };
        if (!prompt || typeof prompt !== "string") {
          return new Response("Missing prompt", { status: 400 });
        }

        const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
        const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? "https://api.openai.com/v1";
        if (!apiKey) {
          return new Response("Missing AI_INTEGRATIONS_OPENAI_API_KEY", { status: 500 });
        }

        const upstream = await fetch(`${baseUrl}/images/generations`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            output_format: "png",
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
