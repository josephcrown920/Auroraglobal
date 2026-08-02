import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateSceneText } from "./scene-weaver-ai.server";

const Input = z.object({ imageDataUrl: z.string().min(20), presetKeys: z.array(z.string()).min(1) });
export const suggestGrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const text = await generateSceneText(
      `You are a film colorist. Choose one preset from ${data.presetKeys.join(", ")}. Return ONLY compact JSON: {"preset":"key","note":"max 14 words","tweaks":{"exposure":1,"contrast":1,"saturation":1,"temp":0,"hue":0,"diffusion":0,"vignette":0}}.`,
      [{ role: "user", content: "Choose a grade for the active scene." }],
      [data.imageDataUrl],
    );
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) as { preset?: string; note?: string; tweaks?: Record<string, number> } : {};
    return {
      preset: parsed.preset && data.presetKeys.includes(parsed.preset) ? parsed.preset : data.presetKeys[0],
      note: (parsed.note ?? "").slice(0, 120),
      tweaks: parsed.tweaks ?? null,
    };
  });