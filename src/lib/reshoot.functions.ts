import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { orchestrate } from "@/lib/orchestrator.server";
import {
  RESHOOT_ANGLES,
  RESHOOT_COST_PER_IMAGE,
  RESHOOT_MODEL,
  buildAnglePrompt,
} from "@/lib/reshoot-angles";

// ─── Multi-angle photo reshoot ───────────────────────────────────────────────
// One reference portrait in → six fixed-angle 9:16 portrait variations out. The
// subject's identity, outfit, environment and lighting are held constant; ONLY
// the camera angle changes. Each image is charged independently (1 Aura), so a
// failed angle auto-refunds its own reservation and partial success is fine.
//
// The angle set, per-image price, model and prompt builder live in
// `@/lib/reshoot-angles` (a pure module) so the Canvas recipe can reuse the exact
// same logic without pulling in this server file.

// Re-export so existing importers (e.g. the /reshoot route) keep working.
export { RESHOOT_ANGLES, RESHOOT_COST_PER_IMAGE };
export type { ReshootAngle } from "@/lib/reshoot-angles";

const ReshootSchema = z.object({
  imageUrl: z.string().url(),
});

/** Best-effort vision pass: describe the subject so the prompts can reinforce
 * identity. The reference image stays the source of truth, so a miss is harmless. */
async function analyzeSubject(imageUrl: string, userId: string): Promise<string | null> {
  try {
    const res = await orchestrate({
      kind: "text",
      model: "lovable/gemini-2.5-flash",
      imageUrls: [imageUrl],
      userId,
      prompt:
        "Look at this portrait and describe, in 2-3 compact sentences, the subject's " +
        "appearance (face, hair, age, build), exact outfit, the environment/background, " +
        "and the lighting. Be concrete and visual. Do not add commentary or preamble.",
    });
    const text = res.text?.trim();
    return text && text.length > 0 ? text.slice(0, 700) : null;
  } catch {
    return null;
  }
}

export type ReshootResult = {
  angleId: string;
  label: string;
  caption: string;
  status: "succeeded" | "failed";
  url?: string;
  generationId?: string;
  error?: string;
};

export const reshootMultiAngle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReshootSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ results: ReshootResult[] }> => {
    const { userId } = context;
    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");

    // Step 1 — best-effort subject analysis (NOT charged; only the images cost).
    const description = await analyzeSubject(data.imageUrl, userId);

    // Step 2 — render all six angles in parallel, each charged on its own so a
    // failed angle releases only its own reservation and the rest still land.
    const settled = await Promise.allSettled(
      RESHOOT_ANGLES.map((angle) =>
        reserveOrchestrateRecord({
          userId,
          kind: "image",
          prompt: `[Reshoot / ${angle.label}] ${buildAnglePrompt(angle, description)}`,
          model: RESHOOT_MODEL,
          imageUrls: [data.imageUrl],
          cost: RESHOOT_COST_PER_IMAGE,
          reason: "reshoot_angle",
        }),
      ),
    );

    const results: ReshootResult[] = settled.map((outcome, i) => {
      const angle = RESHOOT_ANGLES[i];
      const meta = { angleId: angle.id, label: angle.label, caption: angle.caption };
      if (outcome.status === "rejected") {
        const error = outcome.reason instanceof Error ? outcome.reason.message : "Render failed";
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
