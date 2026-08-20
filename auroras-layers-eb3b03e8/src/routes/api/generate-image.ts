import { createFileRoute } from "@tanstack/react-router";
import { IMAGE_MODELS, DEFAULT_IMAGE_MODEL } from "@/lib/auroraModels";

type Body = {
  prompt: string;
  imageDataUrl?: string;
  characterReferenceDataUrl?: string;
  model?: string;
  stream?: boolean;
};

const ALLOWED_MODELS = IMAGE_MODELS.filter((item) => item.available).map((item) => item.id);

function parseImageDataUrl(value: string) {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (!match?.[1] || !match[2]) return null;
  return { type: match[1], bytes: Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0)) };
}

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          prompt,
          imageDataUrl,
          characterReferenceDataUrl,
          model: requested,
          stream = true,
        } = (await request.json()) as Body;


        if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
          return new Response(JSON.stringify({ error: "A prompt is required." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const model =
          requested && (ALLOWED_MODELS as readonly string[]).includes(requested)
            ? requested
            : DEFAULT_IMAGE_MODEL;

        const lockedPrompt = imageDataUrl
          ? `${prompt.trim()}\n\nCONTINUITY CONTRACT: Treat the input as a locked plate, not inspiration. Keep every person's identity, ethnicity, skin tone, facial geometry, body proportions, hairstyle, expression, hand position and pose unchanged unless explicitly targeted. Preserve exact camera position, crop, lens perspective, lighting direction, background geometry and left-to-right subject order. The person currently on camera-left must remain camera-left; the person on camera-right must remain camera-right. Never mirror, flip, swap, recast or reposition anybody. Modify only the named clothing, prop or region; all untouched pixels should remain visually unchanged.`
          : prompt.trim();

        const content: Array<Record<string, unknown>> = [{ type: "text", text: lockedPrompt }];
        if (imageDataUrl?.startsWith("data:image/")) {
          content.push({ type: "image_url", image_url: { url: imageDataUrl } });
        }
        if (characterReferenceDataUrl?.startsWith("data:image/")) {
          content.push({ type: "image_url", image_url: { url: characterReferenceDataUrl } });
        }

        const openAiSource = imageDataUrl ? parseImageDataUrl(imageDataUrl) : null;
        const openAiCharacter = characterReferenceDataUrl
          ? parseImageDataUrl(characterReferenceDataUrl)
          : null;
        let upstream: Response;
        if (model.startsWith("openai/") && openAiSource) {
          const form = new FormData();
          form.append("model", model);
          form.append("prompt", lockedPrompt);
          form.append("image", new Blob([openAiSource.bytes], { type: openAiSource.type }), "reference.png");
          if (openAiCharacter) {
            form.delete("image");
            form.append("image[]", new Blob([openAiSource.bytes], { type: openAiSource.type }), "locked-plate.png");
            form.append("image[]", new Blob([openAiCharacter.bytes], { type: openAiCharacter.type }), "character-reference.png");
          }
          form.append("quality", "low");
          if (stream) {
            form.append("stream", "true");
            form.append("partial_images", "1");
          }
          upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: form,
          });
        } else {
          // OpenAI generation takes `prompt`; Gemini reference editing takes `messages` + `modalities`.
          const body = model.startsWith("openai/")
          ? {
              model,
              prompt: lockedPrompt,
              quality: "low",
              ...(stream ? { stream: true, partial_images: 1 } : {}),
            }
          : {
              model,
              messages: [{ role: "user", content }],
              modalities: ["image", "text"],
              ...(stream ? { stream: true } : {}),
            };
          upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
        }


        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          return new Response(text || JSON.stringify({ error: "Image generation failed" }), {
            status: upstream.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!stream) {
          return new Response(upstream.body, {
            headers: { "Content-Type": "application/json" },
          });
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
