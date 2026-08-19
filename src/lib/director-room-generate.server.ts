import { z } from "zod";
import { computeCost, detectFeatures } from "@/lib/pricing";
import type { RenderInput, RenderOutcome } from "@/lib/generate-core.server";

export const DIRECTOR_ROOM_IMAGE_MODEL = "replit/gemini-2.5-flash-image";

const RequestSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  references: z.array(z.string().url()).max(4).optional().default([]),
});

export type DirectorRoomImageDeps = {
  getUserId: (token: string) => Promise<string | null>;
  assertOwnedReferenceImage: (url: string, userId: string) => Promise<void>;
  assertDailyBudget: (userId: string, estimatedCost: number) => Promise<void>;
  reserveOrchestrateRecord: (input: RenderInput) => Promise<RenderOutcome>;
};

async function productionDeps(): Promise<DirectorRoomImageDeps> {
  const [{ supabaseAdmin }, { assertOwnedReferenceImage }, { assertDailyBudget }, { reserveOrchestrateRecord }] =
    await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/url-guard"),
      import("@/lib/cost-guardrails.server"),
      import("@/lib/generate-core.server"),
    ]);

  return {
    getUserId: async (token) => {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    },
    assertOwnedReferenceImage,
    assertDailyBudget,
    reserveOrchestrateRecord,
  };
}

function json(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Authenticated Director Room image generation.
 *
 * This handler deliberately accepts only the image flow used by the storyboard
 * workspace. Credit reservation, provider dispatch, generation recording, and
 * refund-on-failure all remain in reserveOrchestrateRecord.
 */
export async function handleDirectorRoomImageRequest(
  request: Request,
  deps?: DirectorRoomImageDeps,
): Promise<Response> {
  const d = deps ?? (await productionDeps());
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return json({ error: "Sign in to generate Director Room images." }, 401);
  }

  const userId = await d.getUserId(auth.slice(7));
  if (!userId) return json({ error: "Unauthorized" }, 401);

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "prompt required and references must be valid URLs" }, 400);

  const { prompt, references } = parsed.data;
  try {
    await Promise.all(references.map((url) => d.assertOwnedReferenceImage(url, userId)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Reference image is not allowed" }, 400);
  }

  const { features } = detectFeatures({ kind: "image" });
  const quote = computeCost({ features, model: DIRECTOR_ROOM_IMAGE_MODEL });

  try {
    await d.assertDailyBudget(userId, quote.total);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Daily generation limit reached" }, 400);
  }

  try {
    const outcome = await d.reserveOrchestrateRecord({
      userId,
      kind: "image",
      model: DIRECTOR_ROOM_IMAGE_MODEL,
      pinnedModelOnly: true,
      prompt,
      imageUrls: references.length ? references : undefined,
      cost: quote.total,
      reason: "director_room_image",
    });

    if (!outcome.ok) {
      return json({ error: outcome.error }, outcome.insufficient ? 402 : 400);
    }

    return json(
      {
        ok: true,
        url: outcome.url,
        generationId: outcome.generationId,
        provider: outcome.provider,
        endpoint: outcome.endpoint,
        latencyMs: outcome.latencyMs,
        estimatedCostUsd: outcome.costUsd,
        creditsCost: quote.total,
        costBreakdown: quote.breakdown,
      },
      200,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /rate.?limit/i.test(message) ? 429 : 502;
    return json({ error: message }, status);
  }
}