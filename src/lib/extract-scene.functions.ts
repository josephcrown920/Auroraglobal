import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateSceneImage } from "./scene-weaver-ai.server";

const Input = z.object({ imageDataUrl: z.string().min(20), instruction: z.string().max(800).optional() });
const PROMPT = "Remove every person from this image completely. Reconstruct the background naturally. Preserve the exact lighting, camera angle, lens depth of field, color grade, film grain, props, architecture, framing, and aspect ratio. Do not add new subjects. Return only the cleaned scene as an image.";

export const extractScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => ({
    imageDataUrl: await generateSceneImage(
      `${PROMPT}${data.instruction ? `\nAdditional direction: ${data.instruction}` : ""}`,
      [data.imageDataUrl],
    ),
  }));