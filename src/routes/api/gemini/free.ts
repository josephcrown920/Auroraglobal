import { createFileRoute } from "@tanstack/react-router";
import { GoogleGenAI } from "@google/genai";
import { FREE_AI_MODELS } from "@/lib/ai-gateway-free-models";

const ALLOWED = new Set(
  FREE_AI_MODELS.filter((model) => model.provider === "google-gemini" && model.free).map((model) => model.id),
);

type Body = {
  model?: string;
  prompt?: string;
  system?: string;
};

export const Route = createFileRoute("/api/gemini/free")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return new Response("GEMINI_API_KEY is not configured", { status: 503 });

        const body = (await request.json().catch(() => ({}))) as Body;
        const model = body.model?.trim() || "gemini-3.8-flash";
        if (!ALLOWED.has(model)) return new Response("Unsupported Gemini free-tier model", { status: 400 });
        if (!body.prompt?.trim()) return new Response("Prompt required", { status: 400 });

        try {
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model,
            contents: body.prompt.trim(),
            config: body.system?.trim() ? { systemInstruction: body.system.trim() } : undefined,
          });

          return Response.json({ model, text: response.text ?? "" });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Gemini request failed";
          return Response.json({ error: message }, { status: 502 });
        }
      },
    },
  },
});
