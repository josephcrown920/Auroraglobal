import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateSceneText } from "./scene-weaver-ai.server";

const Input = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).min(1),
  sceneName: z.string().optional(),
  hasResult: z.boolean().optional(),
  variantCount: z.number().optional(),
});
export const sceneChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const text = await generateSceneText(
      `You are Scene Weaver, a terse VFX and plate-cleanup copilot. Active scene: ${data.sceneName ?? "untitled"}. Clean plate ready: ${data.hasResult ? "yes" : "no"}. Alternate angles: ${data.variantCount ?? 0}. Reply ONLY as JSON with keys reply, action, instruction. action must be one of none, refine, angle, upscale, rebuild. Never mention providers.`,
      data.messages,
    );
    try {
      const parsed = JSON.parse(text) as { reply?: string; action?: string; instruction?: string };
      return {
        reply: parsed.reply ?? text,
        action: ["none", "refine", "angle", "upscale", "rebuild"].includes(parsed.action ?? "") ? parsed.action : "none",
        instruction: parsed.instruction ?? "",
      };
    } catch {
      return { reply: text || "I’m ready when you are.", action: "none", instruction: "" };
    }
  });