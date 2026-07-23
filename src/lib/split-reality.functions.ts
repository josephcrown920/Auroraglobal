import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwnStudioUpload } from "@/lib/url-guard";
import { PRICING } from "@/lib/pricing";

// ─── Split Reality ────────────────────────────────────────────────────────────
// Two parallel image generations from the same reference(s):
//   mirror mode    → ultra-real mirror-selfie + cinematic anamorphic close-up
//   characters mode → Character A living their life + Character B living theirs,
//                     both doing the exact same shared action simultaneously.
//
// Each side is one reserveOrchestrateRecord call (kind: "image", editStrict: true)
// — the two run concurrently so total wall-clock ≈ single generation time.
// Cost = 2 × PRICING.base.image (10 Aura each = 20 Aura total).

export const SPLIT_REALITY_MODEL = "google/nano-banana";

const MirrorInput = z.object({
  mode: z.literal("mirror"),
  imageUrls: z.array(z.string().url()).min(1).max(5),
  basePrompt: z.string().max(600).optional(),
});

const CharactersInput = z.object({
  mode: z.literal("characters"),
  imageUrlsA: z.array(z.string().url()).min(1).max(4),
  imageUrlsB: z.array(z.string().url()).min(1).max(4),
  action: z.string().min(3).max(300),
  lifeA: z.string().max(300).optional(),
  lifeB: z.string().max(300).optional(),
  basePrompt: z.string().max(600).optional(),
});

export const SplitRealityInput = z.discriminatedUnion("mode", [MirrorInput, CharactersInput]);

/** Blocking result — both sides are fully rendered when this resolves. */
export type SplitRealityResult = {
  left:  { id: string; url: string; variant: "left" };
  right: { id: string; url: string; variant: "right" };
};

export const splitRealityGenerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SplitRealityInput.parse(input))
  .handler(async ({ data, context }): Promise<SplitRealityResult> => {
    const { userId } = context;

    // Assert ownership for all uploaded reference images.
    const allUrls =
      data.mode === "mirror"
        ? data.imageUrls
        : [...data.imageUrlsA, ...data.imageUrlsB];
    for (const url of allUrls) {
      assertOwnStudioUpload(url, userId);
    }

    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");

    let leftPrompt: string;
    let rightPrompt: string;
    let leftImageUrls: string[];
    let rightImageUrls: string[];

    if (data.mode === "mirror") {
      const base = data.basePrompt ? ` Additional direction: ${data.basePrompt.trim()}.` : "";
      leftPrompt =
        `[Split Reality — Ultra-real] Documentary mirror-selfie of the subject: ` +
        `natural skin texture, casual indoor light, no styling, phone camera perspective, ` +
        `unfiltered and intimate. Keep every detail from the reference exactly as-is — ` +
        `identity, expression, pose, clothing.${base}`;
      rightPrompt =
        `[Split Reality — Cinematic] Anamorphic cinematic close-up of the same subject: ` +
        `windswept hair, ARRI lens shallow bokeh, deep Kodak color grade, editorial ` +
        `three-point lighting, moody and film-like. Identity and features must match ` +
        `the reference exactly.${base}`;
      leftImageUrls = data.imageUrls;
      rightImageUrls = data.imageUrls;
    } else {
      const base = data.basePrompt ? ` Extra direction: ${data.basePrompt.trim()}.` : "";
      const actionPhrase = data.action.trim();
      const contextA = data.lifeA?.trim() ? ` Life context: ${data.lifeA.trim()}.` : "";
      const contextB = data.lifeB?.trim() ? ` Life context: ${data.lifeB.trim()}.` : "";
      leftPrompt =
        `[Split Reality — Character A] This character is ${actionPhrase}.${contextA} ` +
        `Render their environment and styling to reflect their life. ` +
        `Keep the subject's identity exactly as shown in the reference.${base}`;
      rightPrompt =
        `[Split Reality — Character B] This character is ${actionPhrase}.${contextB} ` +
        `Render their environment and styling to reflect their life. ` +
        `Keep the subject's identity exactly as shown in the reference.${base}`;
      leftImageUrls = data.imageUrlsA;
      rightImageUrls = data.imageUrlsB;
    }

    const [leftRes, rightRes] = await Promise.all([
      reserveOrchestrateRecord({
        userId,
        kind: "image",
        prompt: leftPrompt,
        model: SPLIT_REALITY_MODEL,
        editStrict: true,
        imageUrls: leftImageUrls,
        cost: PRICING.base.image,
        reason: "split_reality",
      }),
      reserveOrchestrateRecord({
        userId,
        kind: "image",
        prompt: rightPrompt,
        model: SPLIT_REALITY_MODEL,
        editStrict: true,
        imageUrls: rightImageUrls,
        cost: PRICING.base.image,
        reason: "split_reality",
      }),
    ]);

    if (!leftRes.ok)  throw new Error(leftRes.error  ?? "Split Reality — left side failed");
    if (!rightRes.ok) throw new Error(rightRes.error ?? "Split Reality — right side failed");

    const leftUrl  = leftRes.url  ?? "";
    const rightUrl = rightRes.url ?? "";

    if (!leftUrl)  throw new Error("Split Reality — left side returned no image URL");
    if (!rightUrl) throw new Error("Split Reality — right side returned no image URL");

    return {
      left:  { id: leftRes.generationId,  url: leftUrl,  variant: "left" },
      right: { id: rightRes.generationId, url: rightUrl, variant: "right" },
    };
  });
