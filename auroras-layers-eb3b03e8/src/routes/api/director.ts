import { createFileRoute } from "@tanstack/react-router";
import { BRAIN_MODELS, DEFAULT_BRAIN_MODEL } from "@/lib/auroraModels";

type Msg = { role: "user" | "assistant"; content: string };

const SYSTEM = `You are AURORA DIRECTOR — a cinematic AI director inside Aurora Performance Studio,
a layer-based image studio for music artists (trap / hip-hop visual language).

Your job: turn a loose idea into a shoot. Think like a DP + stylist + colorist, not a chatbot.

For every request, answer in this exact structure, short and punchy:

LOGLINE — one sentence of story.
SHOT — lens (e.g. 35mm / 85mm), framing, camera height, movement.
LIGHT — key/fill/rim, color temperature, practicals, mood.
WARDROBE — specific pieces, textures, jewelry, grooming.
PALETTE — 3-4 colors, named.
PROMPT — one dense paragraph, ready to paste into an image model. Preserve the subject's
identity, skin tone, pose and framing when a source image exists; only change what was asked.
Never invent a different person. Never flip the composition.
NEXT — two alternate directions, one line each.

Rules: no preamble, no apologies, no markdown headers other than the labels above.
Keep the whole answer under 220 words.`;

export const Route = createFileRoute("/api/director")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, model: requestedModel } = (await request.json()) as {
          messages: Msg[];
          model?: string;
        };
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("messages required", { status: 400 });
        }

        const model = BRAIN_MODELS.some(
          (item) => item.available && item.id === requestedModel,
        )
          ? requestedModel
          : DEFAULT_BRAIN_MODEL;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            stream: true,
            messages: [{ role: "system", content: SYSTEM }, ...messages.slice(-12)],
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || "Director unavailable", { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
