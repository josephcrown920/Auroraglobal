// @ts-nocheck
// Batch generation server functions — run N image generations in parallel.
// Each item in the batch gets the same base prompt with an optional style
// blueprint suffix. All generations reserve credits individually.
//
// Usage: call batchGenerate with a basePrompt, count (2–30 for creator, up to 100
// for studio), and an optional blueprintId from style-blueprints.ts.
// The function runs all reserveOrchestrateRecord calls concurrently and
// returns an array of results in order (failed items have ok:false + error).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PRICING } from "@/lib/pricing";
import { applyBlueprint } from "@/lib/batch/style-blueprints";

const BatchGenerateSchema = z.object({
  basePrompt: z.string().min(3).max(800),
  count: z.number().int().min(2).max(100),
  blueprintId: z.string().optional(),
  /** Optional per-item prompt suffix overrides (length must equal count if provided). */
  promptOverrides: z.array(z.string().max(200)).optional(),
  imageUrls: z.array(z.string().url()).max(5).optional(),
});

export type BatchGenerateResult = {
  index: number;
  ok: boolean;
  generationId: string;
  url: string;
  prompt: string;
  error?: string;
};

export const batchGenerate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BatchGenerateSchema.parse(input))
  .handler(async ({ data, context }): Promise<BatchGenerateResult[]> => {
    const { userId } = context;
    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");

    const jobs = Array.from({ length: data.count }, (_, i) => {
      let prompt = data.basePrompt;
      if (data.blueprintId) prompt = applyBlueprint(prompt, data.blueprintId);
      if (data.promptOverrides?.[i]) prompt = `${prompt} — ${data.promptOverrides[i]}`;
      return { index: i, prompt };
    });

    const results = await Promise.allSettled(
      jobs.map(async ({ index, prompt }) => {
        const r = await reserveOrchestrateRecord({
          userId,
          kind: "image",
          prompt,
          imageUrls: data.imageUrls,
          cost: PRICING.base.image,
          reason: "batch",
        });
        if (!r.ok) throw new Error(r.error ?? "Batch item failed");
        return { index, ok: true as const, generationId: r.generationId, url: r.url ?? "", prompt };
      }),
    );

    return results.map((res, i) => {
      if (res.status === "fulfilled") return res.value;
      return {
        index: i,
        ok: false,
        generationId: "",
        url: "",
        prompt: jobs[i].prompt,
        error: res.reason instanceof Error ? res.reason.message : "Unknown error",
      };
    });
  });

const BatchStatusSchema = z.object({
  batchId: z.string().uuid().optional(),
  generationIds: z.array(z.string().uuid()).max(100).optional(),
});

export const getBatchStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BatchStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/admin-client");
    const ids = data.generationIds ?? [];
    if (ids.length === 0) return { items: [] };
    const { data: rows } = await supabaseAdmin
      .from("generations")
      .select("id, status, result_url, error_message")
      .in("id", ids)
      .eq("user_id", context.userId);
    return { items: rows ?? [] };
  });
