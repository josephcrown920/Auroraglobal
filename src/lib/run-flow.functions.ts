import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateSceneImage } from "./scene-weaver-ai.server";

const Input = z.object({ prompt: z.string().min(3).max(2000), images: z.array(z.string().min(20)).max(6) });
export const runFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => ({ imageDataUrl: await generateSceneImage(data.prompt, data.images) }));