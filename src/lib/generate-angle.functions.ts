import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateSceneImage } from "./scene-weaver-ai.server";

const Input = z.object({ imageDataUrl: z.string().min(20), angle: z.string().min(1).max(500) });
export const generateAngle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => ({
    imageDataUrl: await generateSceneImage(
      `You are given a clean plate photograph. Synthesize a plausible new camera view of the same scene from a different angle. Keep the same environment, props, lighting, time of day, color grade, and film grain. Do not add people. Preserve object identities. Requested view: ${data.angle}`,
      [data.imageDataUrl],
    ),
  }));