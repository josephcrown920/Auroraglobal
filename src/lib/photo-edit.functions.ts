import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwnStudioUpload } from "@/lib/url-guard";
import { PRICING } from "@/lib/pricing";

// ─── Photo Editor ────────────────────────────────────────────────────────────
// One uploaded photo + one edit instruction → one edited photo. Runs on
// google/nano-banana ON PURPOSE: its "anchor to the input image, apply light
// changes" behaviour — which made it wrong for batch scene generation — is
// exactly right for editing. `editStrict` keeps every fallback edit-capable
// (never pollinations, never the GPU pool), so a failed edit fails
// explicitly instead of silently returning an unrelated generated image.

export const PHOTO_EDIT_MODEL = "google/nano-banana";

const PhotoEditSchema = z.object({
  imageUrl: z.string().url().max(2048),
  editPrompt: z.string().min(2).max(800),
});

export const editPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PhotoEditSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    assertOwnStudioUpload(data.imageUrl, userId);
    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");

    const prompt =
      `[Photo Edit] Edit the attached photo: ${data.editPrompt}. Apply only the ` +
      `requested change — keep the subject's identity, pose, framing, background ` +
      `and lighting exactly as they are unless the edit explicitly asks to change them.`;

    const r = await reserveOrchestrateRecord({
      userId,
      kind: "image",
      prompt,
      model: PHOTO_EDIT_MODEL,
      editStrict: true,
      imageUrls: [data.imageUrl],
      cost: PRICING.base.image,
      reason: "photo_edit",
    });
    if (!r.ok) throw new Error(r.error);
    return { generationId: r.generationId, url: r.url };
  });
