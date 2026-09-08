import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildWidePrompt,
  buildCloseupPrompt,
  COLORS_SHOW_COST_PER_SHOT,
} from "@/lib/colors-show.templates";
import { assertOwnedReferenceImage } from "@/lib/url-guard";

const MODEL = "google/gemini-3.1-flash-image-preview";
export const COLORS_SHOW_ALLOWED_MODELS = [
  MODEL,
  "google/nano-banana-pro",
  "google/nano-banana",
] as const;
export const COLORS_SHOW_ALLOWED_PROVIDERS = ["gemini", "replicate"] as const;

const ColorsShowShotSchema = z.object({
  selfieUrl: z.string().url(),
  colorName: z.string().min(1).max(100),
  outfit: z.string().min(3).max(300),
  shotType: z.enum(["wide", "closeup"]),
  wideRefUrl: z.string().url(),
  closeupRefUrl: z.string().url(),
  outfitRefUrl: z.string().url().optional(),
  location: z.string().max(500).optional(),
});
type ColorsShowShotInput = z.infer<typeof ColorsShowShotSchema>;

export async function assertColorsShowReferencesOwned(
  data: ColorsShowShotInput,
  userId: string,
  assertOwned: typeof assertOwnedReferenceImage = assertOwnedReferenceImage,
): Promise<void> {
  await Promise.all([
    data.selfieUrl,
    data.wideRefUrl,
    data.closeupRefUrl,
    ...(data.outfitRefUrl ? [data.outfitRefUrl] : []),
  ].map((url) => assertOwned(url, userId)));
}

export function buildColorsShowRenderInput(data: ColorsShowShotInput) {
  const label = data.shotType === "wide" ? "Wide Shot" : "Close-Up";
  const prompt = data.shotType === "wide"
    ? buildWidePrompt(data.colorName, data.outfit, data.location)
    : buildCloseupPrompt(data.colorName, data.outfit, data.location);
  const compositionRef = data.shotType === "wide" ? data.wideRefUrl : data.closeupRefUrl;
  return {
    prompt: `[Colors Show / ${label}]\n\n${prompt}`,
    model: MODEL,
    editStrict: true as const,
    allowedModels: [...COLORS_SHOW_ALLOWED_MODELS],
    allowedProviders: [...COLORS_SHOW_ALLOWED_PROVIDERS],
    imageUrls: [data.selfieUrl, ...(data.outfitRefUrl ? [data.outfitRefUrl] : []), compositionRef],
  };
}

export type ColorsShowShotOutcome =
  | { ok: true; url: string; generationId: string }
  | { ok: false; error: string };

export const generateColorsShowShot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ColorsShowShotSchema.parse(input))
  .handler(async ({ data, context }): Promise<ColorsShowShotOutcome> => {
    const { userId, supabase } = context;
    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");

    await assertColorsShowReferencesOwned(data, userId);
    const dispatch = buildColorsShowRenderInput(data);

    const result = await reserveOrchestrateRecord({
      userId,
      kind: "image",
      ...dispatch,
      cost: COLORS_SHOW_COST_PER_SHOT,
      reason: "colors_show",
    });

    if (!result.ok) return { ok: false, error: result.error };

    // Return the persisted studio-bucket URL (stored in generations.result_image_url)
    // rather than the raw provider URL (result.url), so the Animate → Motion
    // deep-link passes assertOwnedReferenceImage on the Motion Transfer server fn.
    const { data: genRow } = await supabase
      .from("generations")
      .select("result_image_url")
      .eq("id", result.generationId)
      .maybeSingle();
    const url = (genRow?.result_image_url as string | null | undefined) ?? result.url;

    return { ok: true, url, generationId: result.generationId };
  });
