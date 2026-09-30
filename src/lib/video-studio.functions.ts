import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { routedGenerate } from "@/lib/ai-router";
import {
  buildVideoEditorPrompt,
  VIDEO_EDITOR_SYSTEM,
  VideoEditRecommendationSchema,
} from "@/lib/video-studio.schema";

export const recommendVideoEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        brief: z.string().trim().min(4).max(2000),
        clipCount: z.number().int().min(1).max(10),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const { output } = await routedGenerate({
        system: VIDEO_EDITOR_SYSTEM,
        prompt: buildVideoEditorPrompt(data.brief, data.clipCount),
        schema: VideoEditRecommendationSchema,
        category: "VIDEO_DIRECTION",
      });
      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Video edit recommendation failed";
      if (message.includes("No LLM provider")) {
        throw new Error("No AI model is configured for the Video Studio Editor Agent.");
      }
      if (message.includes("429")) {
        throw new Error("The Video Studio Editor Agent is rate-limited. Try again in a moment.");
      }
      throw new Error(message);
    }
  });
