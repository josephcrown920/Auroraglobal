import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { orchestrate } from "@/lib/orchestrator.server";

// ─── Multi-angle photo reshoot ───────────────────────────────────────────────
// One reference portrait in → six fixed-angle 9:16 portrait variations out. The
// subject's identity, outfit, environment and lighting are held constant; ONLY
// the camera angle changes. Each image is charged independently (1 Aura), so a
// failed angle auto-refunds its own reservation and partial success is fine.

/** Per-image price (Aura) — kept in lockstep with the live cost shown in the UI. */
export const RESHOOT_COST_PER_IMAGE = 1;

/** The identity-preserving image model used by the other identity tools. */
const RESHOOT_MODEL = "google/gemini-3.1-flash-image-preview";

export type ReshootAngle = {
  /** Stable key, also used as the credit-ledger / shot id suffix. */
  id: string;
  /** Human label shown in the UI. */
  label: string;
  /** Short blurb under the result card. */
  caption: string;
  /** The camera-angle directive injected into the generation prompt. */
  directive: string;
};

/** The six fixed camera angles, in display order. */
export const RESHOOT_ANGLES: readonly ReshootAngle[] = [
  {
    id: "fisheye",
    label: "Fish-eye",
    caption: "Ultra-wide fish-eye lens · curved, immersive distortion",
    directive:
      "Shot on an ultra-wide fish-eye lens at close range: strong barrel distortion, curved bulging perspective, the subject's face filling the centre with the edges of the frame warping outward.",
  },
  {
    id: "birdseye",
    label: "Bird's-eye",
    caption: "High overhead bird's-eye view looking straight down",
    directive:
      "A bird's-eye view from high directly overhead, camera pointing straight down at the subject, top-of-head and shoulders foreshortened, a clear sense of looking down from above.",
  },
  {
    id: "lowangle",
    label: "Low angle",
    caption: "Low camera angle tilted up · heroic, towering",
    directive:
      "A dramatic low camera angle positioned below the subject and tilted upward, making them look tall and powerful, with the background sweeping up behind them.",
  },
  {
    id: "dutch",
    label: "Dutch angle",
    caption: "Tilted Dutch angle · dynamic, off-kilter horizon",
    directive:
      "A Dutch angle: the camera is rolled so the horizon is noticeably tilted on a diagonal, creating an edgy, dynamic, off-kilter composition.",
  },
  {
    id: "macro",
    label: "Macro close-up",
    caption: "Extreme macro close-up · fine detail, shallow focus",
    directive:
      "An extreme macro close-up filling the frame with the subject's face, razor-thin depth of field, crisp skin and eye detail, soft creamy background bokeh.",
  },
  {
    id: "wormseye",
    label: "Worm's-eye",
    caption: "Worm's-eye view from ground level looking up",
    directive:
      "A worm's-eye view from ground level looking steeply up at the subject, exaggerated upward perspective with the sky or ceiling opening up behind them.",
  },
] as const;

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

/** Build the generation prompt for one angle. The reference image is authoritative;
 * the analysis description (if any) is only supplementary context. */
function buildAnglePrompt(angle: ReshootAngle, description: string | null): string {
  const base =
    "Re-photograph the person in the attached reference image, which is the ABSOLUTE " +
    "source of truth for their facial identity, likeness, outfit, body, hairstyle, " +
    "the environment/background and the lighting — keep ALL of these identical. " +
    `Change ONLY the camera angle. ${angle.directive} ` +
    "Output a single photorealistic 9:16 vertical portrait (tall, full-height frame). " +
    "Do not alter the wardrobe, scene or lighting; do not add text, watermarks or borders.";
  return description
    ? `${base}\n\nReference context (secondary — ignore anything that conflicts with the image): ${description}`
    : base;
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
