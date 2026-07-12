import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildColorsShowPrompt,
  COLORS_SHOW_COST_PER_SHOT,
  COLORS_SHOW_SHOTS,
} from "@/lib/colors-show.templates";

const MODEL = "google/gemini-3.1-flash-image-preview";

const ColorsShowSchema = z.object({
  portraitUrl: z.string().url(),
  colorId: z.string().min(1),
  outfitOption: z.string().min(1),
  customOutfit: z.string().max(300),
  selectedShots: z.array(z.string()).min(1).max(4),
  energyOption: z.string().min(1),
  songTitle: z.string().max(100),
});

export type ColorsShowResult = {
  shotId: string;
  label: string;
  status: "succeeded" | "failed";
  url?: string;
  generationId?: string;
  error?: string;
};

export const generateColorsShow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ColorsShowSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ results: ColorsShowResult[] }> => {
    const { userId } = context;
    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");

    const shots = COLORS_SHOW_SHOTS.filter((s) => data.selectedShots.includes(s.id));

    const settled = await Promise.allSettled(
      shots.map((shot) =>
        reserveOrchestrateRecord({
          userId,
          kind: "image",
          prompt: `[Colors Show / ${shot.label}]\n\n${buildColorsShowPrompt(data, shot)}`,
          model: MODEL,
          imageUrls: [data.portraitUrl],
          cost: COLORS_SHOW_COST_PER_SHOT,
          reason: "colors_show",
        }),
      ),
    );

    const results: ColorsShowResult[] = settled.map((outcome, i) => {
      const shot = shots[i];
      const meta = { shotId: shot.id, label: shot.label };
      if (outcome.status === "rejected") {
        const error =
          outcome.reason instanceof Error ? outcome.reason.message : "Render failed";
        return { ...meta, status: "failed", error };
      }
      const r = outcome.value;
      if (!r.ok) return { ...meta, status: "failed", error: r.error };
      return {
        ...meta,
        status: "succeeded",
        url: r.url,
        generationId: r.generationId,
      };
    });

    return { results };
  });
