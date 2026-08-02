import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateSceneImage } from "./scene-weaver-ai.server";

const Input = z.object({ imageDataUrl: z.string().min(20), factor: z.enum(["2x", "4x"]).default("2x") });
export const upscaleScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => ({
    imageDataUrl: await generateSceneImage(
      `Upscale and restore this photograph to ${data.factor}. Recover fine detail, edges, textures, reflections, and micro-contrast. Remove compression artifacts gently while preserving natural grain. Do not change composition, framing, color grade, or content. Return only the enhanced image.`,
      [data.imageDataUrl],
    ),
  }));