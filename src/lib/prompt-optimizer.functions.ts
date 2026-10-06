import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { routedGenerate } from "@/lib/ai-router";

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
    const userMessage = data.templateTitle
      ? `Template context: "${data.templateTitle}"\nUser's brief: "${data.userText}"\n\nExpand into a detailed generation prompt:`
      : `User's brief: "${data.userText}"\n\nExpand into a detailed generation prompt:`;

    const { output } = await routedGenerate({
      system: SYSTEM_PROMPT,
      prompt: userMessage,
      schema: z.object({ expanded: z.string().min(1).max(3000) }),
      category: "IMAGE_PROMPTS",
    });
    return { expanded: output.expanded.trim() };
  });
