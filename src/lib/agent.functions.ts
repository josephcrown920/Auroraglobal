import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateWithFallback } from "@/lib/llm-fallback.server";


const SYSTEM = `You are AURORA AGENT — a senior music-video / short-film director.
A user gives you ONE paragraph describing a story/shoot they want to create.
Return a complete production breakdown the user can execute immediately:
- 1-2 sentence creative direction (mood, references, palette)
- 4-8 shots, each with: shot type, camera, action, and a FULL ready-to-use image prompt
  (~80-150 words, cinematic, 16mm/35mm-film vocabulary, deep focus, no bloom/no lens flare)
- 3-5 color/grade keywords
- A short list of next-step suggestions ("generate shot 1", "split-reality on shot 3", etc.)
Write prompts so good the user does not need to edit them. Be specific about wardrobe,
lighting, lens, camera move, and environment. Never use markdown formatting in fields —
return clean text only.`;

const ShotSchema = z.object({
  id: z.string().describe("Short id like S1, S2"),
  title: z.string().describe("Shot title, 3-6 words"),
  shotType: z.string().describe("Wide / Medium / Close-up / OTS / Dutch / etc"),
  camera: z.string().describe("Lens, movement, frame e.g. '35mm, slow push in, handheld'"),
  action: z.string().describe("1-2 sentence description of what happens"),
  prompt: z.string().describe("Full ready-to-run image prompt, ~80-150 words"),
});

const PlanSchema = z.object({
  title: z.string(),
  logline: z.string().describe("One sentence pitch"),
  direction: z.string().describe("1-2 sentence creative direction with mood/palette/references"),
  palette: z.array(z.string()).min(3).max(6).describe("Hex codes for the color story"),
  shots: z.array(ShotSchema).min(3).max(8),
  suggestions: z.array(z.string()).min(2).max(5),
});

export type AgentPlan = z.infer<typeof PlanSchema>;

export const runAuroraAgent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      brief: z.string().min(4).max(4000),
      referenceImages: z.array(z.string().url()).max(8).optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const refNote = data.referenceImages?.length
      ? `\n\nThe user attached ${data.referenceImages.length} reference image(s). Treat them as the talent / wardrobe / location anchor — keep them visually consistent across every shot.`
      : "";

    try {
      const { output } = await generateWithFallback({
        system: SYSTEM,
        prompt: `BRIEF:\n${data.brief}${refNote}\n\nReturn the full production plan now.`,
        schema: PlanSchema,
      });
      return output as AgentPlan;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Agent failed";
      if (message.includes("429")) throw new Error("Aurora Agent is rate-limited. Try again in a moment.");
      if (message.includes("402")) throw new Error("Out of AI credits. Add credits in workspace settings.");
      throw new Error(message);
    }
  });
