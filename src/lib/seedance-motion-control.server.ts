import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwnedReferenceImage } from "./url-guard";
import { generateModelArkMotion } from "./modelark-seedance-motion.server";

const MODEL_KEYS = ["seedance-2.0-fast", "seedance-2.0", "seedance-2.5"] as const;
const CAMERA_MOVEMENTS = [
  "static",
  "push_in",
  "pull_out",
  "orbit_cw",
  "orbit_ccw",
  "pan_left",
  "pan_right",
  "tilt_up",
  "tilt_down",
  "zoom_in",
  "zoom_out",
  "handheld",
] as const;
const MOTION_TYPES = ["faithful", "expressive", "subtle", "exaggerated"] as const;

const SeedanceMotionSchema = z.object({
  subjectImageUrl: z.string().url(),
  motionVideoUrl: z.string().url(),
  prompt: z.string().trim().min(2).max(2500),
  modelKey: z.enum(MODEL_KEYS).default("seedance-2.0-fast"),
  duration: z.number().int().min(4).max(30).default(5),
  resolution: z.enum(["480p", "720p", "1080p"]).default("720p"),
  cameraMovement: z.enum(CAMERA_MOVEMENTS).optional().nullable(),
  motionType: z.enum(MOTION_TYPES).optional().nullable(),
});

export type SeedanceMotionInput = z.infer<typeof SeedanceMotionSchema>;

/**
 * ModelArk-native motion control.
 *
 * This path deliberately bypasses the generic orchestration fallback chain:
 * motion-control requests must reach the activated Seedance model directly.
 * The motion video is sent as `reference_video` and the subject image as
 * `reference_image`, which is the multimodal reference contract used by
 * Seedance 2.x.
 */
export const generateSeedanceMotion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SeedanceMotionSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertOwnedReferenceImage(data.subjectImageUrl, context.userId);
    await assertOwnedReferenceImage(data.motionVideoUrl, context.userId);

    const result = await generateModelArkMotion({
      modelKey: data.modelKey,
      subjectImageUrl: data.subjectImageUrl,
      motionVideoUrl: data.motionVideoUrl,
      prompt: data.prompt,
      duration: data.duration,
      resolution: data.resolution,
      cameraMovement: data.cameraMovement,
    });

    return {
      videoUrl: result.videoUrl,
      provider: result.provider,
      endpoint: result.endpoint,
      latencyMs: result.latencyMs,
      costUsd: result.costUsd,
    };
  });
