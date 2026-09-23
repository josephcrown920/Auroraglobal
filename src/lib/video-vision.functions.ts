import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { orchestrate } from "@/lib/orchestrator.server";

const VisionMapSchema = z.object({
  imageUrl: z.string().url(),
});

const VisionObjectSchema = z.object({
  label: z.string().max(120),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).optional(),
});

const VisionResponseSchema = z.object({
  objects: z.array(VisionObjectSchema).max(40),
});

/**
 * Vision pass for the compositing editor. Coordinates are normalized to the
 * source frame (0..1), so the editor can place/scale layers at any output
 * resolution or aspect ratio.
 */
export const mapVideoObjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(VisionMapSchema)
  .handler(async ({ data, context }) => {
    const result = await orchestrate({
      kind: "text",
      model: "lovable/gemini-2.5-flash",
      imageUrls: [data.imageUrl],
      userId: context.userId,
      prompt: [
        "Analyze this video-editor reference frame for compositing.",
        "Return ONLY valid JSON with this exact shape:",
        '{"objects":[{"label":"person","x":0.10,"y":0.20,"width":0.30,"height":0.60,"confidence":0.98}]}',
        "Use normalized coordinates: x/y are the top-left; width/height are box size.",
        "Identify people and visually distinct objects that a compositor may need to track, replace, remove, or place around.",
        "Do not include the background as an object. Keep labels short.",
      ].join("\n"),
    });

    const text = result.text?.trim() ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/\s*```$/i, ""));
    } catch {
      parsed = { objects: [] };
    }

    const safe = VisionResponseSchema.safeParse(parsed);
    return safe.success ? safe.data : { objects: [] };
  });
