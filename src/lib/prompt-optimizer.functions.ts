import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM_PROMPT = `You are an expert AI art director and prompt writer for Aurora Studio, a cinematic AI image-to-video generation platform used by musicians, creators, and brands.

Your task: take a user's brief description and expand it into a rich, vivid, specific generation prompt optimised for AI image/video models.

Rules:
- Preserve the user's core product, concept, or subject exactly — do not change what it is
- Add specific details: lighting quality, mood, colour palette, camera angle/lens, background setting, texture
- Keep it cinematic and directorial in tone
- Max 2–3 sentences, no bullet points
- Do NOT introduce people or faces unless the user explicitly mentioned them
- Return ONLY the expanded prompt — no preamble, no labels, no explanation`;

export const expandTemplatePrompt = createServerFn()
  .validator(
    z.object({
      userText: z.string().min(2).max(500),
      templateTitle: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Prompt optimizer unavailable");

    const userMessage = data.templateTitle
      ? `Template context: "${data.templateTitle}"\nUser's brief: "${data.userText}"\n\nExpand into a detailed generation prompt:`
      : `User's brief: "${data.userText}"\n\nExpand into a detailed generation prompt:`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 250,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic error ${res.status}: ${text.slice(0, 120)}`);
    }

    const json = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const expanded =
      json.content.find((c) => c.type === "text")?.text?.trim() ?? data.userText;
    return { expanded };
  });
