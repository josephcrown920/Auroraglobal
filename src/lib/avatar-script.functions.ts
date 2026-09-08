// AI creative writing tools for the Avatar Studio.
// Uses Aurora's shared category router so dead models and missing credentials
// fall through consistently with Prime and the Video Agent.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { routedGenerate } from "@/lib/ai-router";

const ScriptSchema = z.object({ script: z.string().min(1) });

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
    const { output } = await routedGenerate({
      system: "You are a creative director writing camera-facing video scripts for an artist's social media content.",
      prompt: `

Topic / Theme: "${data.theme}"
Style: ${STYLE_INSTRUCTIONS[data.style]}
Target length: ${DURATION_GUIDE[data.duration]}

Rules:
- Put only spoken words in the JSON "script" field — no stage directions, brackets, or formatting
- First-person voice, speaking directly into camera
- Start with a strong line that immediately hooks the viewer
- End with impact — a punchline, a call-to-action, or a memorable close
- Sound like a real human talking, not corporate copy
- No hashtags, no emojis in the script itself

Return JSON: {"script":"the spoken script"}`,
      schema: ScriptSchema,
      category: "SCRIPT_WRITING",
    });
    return { script: output.script.trim() };
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
    const { output } = await routedGenerate({
      system: "You improve camera-facing social video scripts while preserving the creator's intent.",
      prompt: `${ACTION[data.action]}

Original script:
${data.script}

Output only JSON with a single "script" field containing the improved spoken script.`,
      schema: ScriptSchema,
      category: "SCRIPT_WRITING",
    });
    return { script: output.script.trim() };
  });
