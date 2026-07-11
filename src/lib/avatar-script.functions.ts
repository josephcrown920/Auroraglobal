// AI creative writing tools for the Avatar Studio.
// Uses the same provider chain as llm-fallback.server.ts (Gemini → Anthropic → OpenRouter).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function getLLM() {
  if (process.env.GEMINI_API_KEY) {
    return createOpenAICompatible({
      name: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      headers: { Authorization: `Bearer ${process.env.GEMINI_API_KEY}` },
    })("gemini-2.0-flash");
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return createOpenAICompatible({
      name: "anthropic",
      baseURL: "https://api.anthropic.com/v1",
      headers: { Authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}` },
    })("claude-haiku-4-5");
  }
  if (process.env.OPENROUTER_API_KEY) {
    return createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    })("google/gemini-2.0-flash");
  }
  throw new Error("No LLM provider configured for script generation");
}

const STYLE_INSTRUCTIONS = {
  hype: "Energetic, bold, and hype — punchy sentences, commanding presence, like a rap intro or ad.",
  smooth: "Smooth, cool, and confident — flowing rhythm, laid-back energy, effortlessly compelling.",
  story: "Storytelling — draws the listener in with a vivid scene, builds tension, lands a punchline.",
  promo: "Authentic artist promo — real talk, direct to camera, no corporate language.",
};

const DURATION_GUIDE = {
  short: "20–30 words (~10–15 seconds spoken)",
  medium: "50–75 words (~25–35 seconds spoken)",
  long: "110–140 words (~55–70 seconds spoken)",
};

export const writeAvatarScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        theme: z.string().min(1).max(300),
        style: z.enum(["hype", "smooth", "story", "promo"]).default("hype"),
        duration: z.enum(["short", "medium", "long"]).default("medium"),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ script: string }> => {
    const model = getLLM();
    const { text } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: `You are a creative director writing camera-facing video scripts for an artist's social media content.

Topic / Theme: "${data.theme}"
Style: ${STYLE_INSTRUCTIONS[data.style]}
Target length: ${DURATION_GUIDE[data.duration]}

Rules:
- Output ONLY the spoken script — no stage directions, no brackets, no formatting
- First-person voice, speaking directly into camera
- Start with a strong line that immediately hooks the viewer
- End with impact — a punchline, a call-to-action, or a memorable close
- Sound like a real human talking, not corporate copy
- No hashtags, no emojis in the script itself

Script:`,
        },
      ],
    });
    return { script: text.trim() };
  });

export const improveAvatarScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        script: z.string().min(1).max(2000),
        action: z.enum(["improve", "longer", "shorter", "hook", "punchup"]),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ script: string }> => {
    const model = getLLM();
    const ACTION = {
      improve:
        "Improve the flow, rhythm, and emotional impact of this script. Keep the same message and approximate length — make every word earn its place.",
      longer:
        "Expand this script by roughly 60%, adding more vivid detail, energy, and personality while keeping the same tone and voice.",
      shorter:
        "Cut this script down by 40%, keeping only the most powerful, essential lines. No word should be wasted.",
      hook:
        "Add a powerful 1-2 sentence hook at the very beginning that immediately commands attention, then continue with the rest of the original script.",
      punchup:
        "Punch up the entire script — make every line more vivid, bolder, and more memorable. Same ideas, maximum impact.",
    };
    const { text } = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: `${ACTION[data.action]}

Original script:
${data.script}

Output only the improved script text (no instructions, no labels):`,
        },
      ],
    });
    return { script: text.trim() };
  });
