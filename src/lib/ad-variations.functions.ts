// Auto-generate ad variations from a completed Locked-Likeness shot deck:
//   • hooks    — punchy 6-8 word opening lines (LLM text)
//   • captions — 1-2 sentence social captions with 3-5 hashtags (LLM text)
//   • thumbnails / aspect renders — re-render each source shot at 1:1 and 16:9
//     alongside the native 9:16 so a single deck powers every ad channel.
//
// Everything is stored in `ad_variations` keyed by a shared `batch_id` so the
// /jobs dashboard and the /orchestration-engine UI can show them together.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// @ts-nocheck
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { UntypedDb } from "@/integrations/supabase/untyped";

const adminDb = supabaseAdmin as unknown as UntypedDb;
import { orchestrate } from "@/lib/orchestrator.server";
import { assertOwnedReferenceImage } from "@/lib/url-guard";
import { LIKENESS_MODEL, LIKENESS_COST_PER_IMAGE } from "@/lib/likeness-shoot";

export const AD_ASPECTS = ["1:1", "16:9"] as const;
export type AdAspect = (typeof AD_ASPECTS)[number];

export type AdVariationRow = {
  id: string;
  batch_id: string;
  kind: "hook" | "caption" | "thumbnail" | "aspect_render";
  aspect: string | null;
  text_value: string | null;
  url: string | null;
  status: "succeeded" | "failed";
  error: string | null;
  created_at: string;
};

const GenerateSchema = z.object({
  /** Source shot URLs (from a completed likeness shoot). */
  sourceUrls: z.array(z.string().url()).min(1).max(12),
  /** Optional generation ids for provenance in the ledger. */
  sourceGenerationIds: z.array(z.string().uuid()).optional(),
  /** Ad brief — song mood, product, target audience. */
  brief: z.string().min(4).max(600),
  /** Include text hooks/captions (Lovable AI, free). Default true. */
  includeText: z.boolean().optional().default(true),
  /** Include multi-aspect renders (charges 1 Aura each). Default true. */
  includeAspectRenders: z.boolean().optional().default(true),
  /** Aspects to render. */
  aspects: z.array(z.enum(AD_ASPECTS)).optional().default(["1:1", "16:9"] as AdAspect[]),
  /** How many hook + caption variations to draft. */
  textCount: z.number().int().min(1).max(10).optional().default(5),
  likenessId: z.string().uuid().optional(),
});

async function draftText(kind: "hook" | "caption", brief: string, count: number, userId: string) {
  const prompt =
    kind === "hook"
      ? `Draft ${count} short, high-energy ad hooks (6-10 words each) for this campaign brief. Return ONE hook per line, no numbering, no quotes, no emojis unless they add real punch.\n\nBRIEF:\n${brief}`
      : `Draft ${count} scroll-stopping social captions (1-2 sentences + 3-5 relevant hashtags) for this campaign brief. Return ONE caption per line, no numbering.\n\nBRIEF:\n${brief}`;
  try {
    const r = await orchestrate({
      kind: "text",
      model: "lovable/gemini-2.5-flash",
      prompt,
      userId,
    });
    const text = (r.text ?? "").trim();
    return text
      .split("\n")
      .map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, "").trim())
      .filter((l) => l.length > 0)
      .slice(0, count);
  } catch {
    return [];
  }
}

export const generateAdVariations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { reserveOrchestrateRecord } = await import("@/lib/generate-core.server");
    const { sendJobStatusEmail } = await import("@/lib/job-notifications.server");
    const batchId = crypto.randomUUID();
    const uid = context.userId;

    // Ownership: every source shot must be the caller's own asset (own studio
    // upload, own avatar, or a generation result they own). Without this a
    // crafted request could point paid re-renders at another user's private
    // images. Checked up-front so nothing foreign ever reaches a provider.
    await Promise.all(data.sourceUrls.map((u) => assertOwnedReferenceImage(u, uid)));
    if (data.likenessId) {
      const { data: lk } = await adminDb
        .from("likeness_locks")
        .select("id")
        .eq("id", data.likenessId)
        .eq("user_id", uid)
        .maybeSingle();
      if (!lk) throw new Error("Likeness not found");
    }

    void sendJobStatusEmail({
      userId: uid, kind: "ad_render", status: "queued", jobId: batchId,
      title: data.brief.slice(0, 80),
    });
    void sendJobStatusEmail({
      userId: uid, kind: "ad_render", status: "running", jobId: batchId,
      title: data.brief.slice(0, 80),
    });

    // 1) Text variations (Lovable AI, no credits charged per line).
    const [hooks, captions] = data.includeText
      ? await Promise.all([
          draftText("hook", data.brief, data.textCount, uid),
          draftText("caption", data.brief, data.textCount, uid),
        ])
      : [[], []];

    const textRows: Array<{
      user_id: string;
      batch_id: string;
      likeness_id: string | null;
      kind: string;
      text_value: string;
      status: string;
    }> = [];
    for (const h of hooks) {
      textRows.push({
        user_id: uid,
        batch_id: batchId,
        likeness_id: data.likenessId ?? null,
        kind: "hook",
        text_value: h,
        status: "succeeded",
      });
    }
    for (const c of captions) {
      textRows.push({
        user_id: uid,
        batch_id: batchId,
        likeness_id: data.likenessId ?? null,
        kind: "caption",
        text_value: c,
        status: "succeeded",
      });
    }
    if (textRows.length > 0) {
      await adminDb.from("ad_variations").insert(textRows);
    }

    // 2) Aspect renders — re-render each source shot at each requested aspect
    //    (paid: 1 Aura per image). Partial failure is fine.
    const aspectResults: AdVariationRow[] = [];
    if (data.includeAspectRenders && data.aspects.length > 0) {
      const tasks: Array<{ url: string; aspect: AdAspect; genId?: string }> = [];
      data.sourceUrls.forEach((url, i) => {
        for (const a of data.aspects) {
          tasks.push({ url, aspect: a, genId: data.sourceGenerationIds?.[i] });
        }
      });

      const settled = await Promise.allSettled(
        tasks.map((t) =>
          reserveOrchestrateRecord({
            userId: uid,
            kind: "image",
            prompt:
              `[Aspect render / ${t.aspect}] Re-frame this photograph to a clean ${t.aspect} ` +
              `aspect ratio while preserving the subject's identity, wardrobe, lighting, and ` +
              `composition intent. No text, watermarks, borders, or logos.`,
            model: LIKENESS_MODEL,
            imageUrls: [t.url],
            cost: LIKENESS_COST_PER_IMAGE,
            reason: "ad_variation_aspect",
          }),
        ),
      );

      const rowsToInsert: Array<Record<string, unknown>> = [];
      settled.forEach((outcome, i) => {
        const t = tasks[i];
        if (outcome.status === "fulfilled" && outcome.value.ok) {
          rowsToInsert.push({
            user_id: uid,
            batch_id: batchId,
            likeness_id: data.likenessId ?? null,
            source_generation_id: t.genId ?? null,
            kind: "aspect_render",
            aspect: t.aspect,
            url: outcome.value.url,
            status: "succeeded",
          });
        } else {
          const err =
            outcome.status === "rejected"
              ? outcome.reason instanceof Error
                ? outcome.reason.message
                : String(outcome.reason)
              : (outcome.value as { error: string }).error;
          rowsToInsert.push({
            user_id: uid,
            batch_id: batchId,
            likeness_id: data.likenessId ?? null,
            source_generation_id: t.genId ?? null,
            kind: "aspect_render",
            aspect: t.aspect,
            status: "failed",
            error: err,
          });
        }
      });
      if (rowsToInsert.length > 0) {
        const { data: inserted } = await adminDb
          .from("ad_variations")
          .insert(rowsToInsert)
          .select("*");
        for (const r of (inserted ?? []) as AdVariationRow[]) aspectResults.push(r);
      }
    }

    // 3) Return the whole batch fresh for the UI.
    const { data: fullBatch } = await adminDb
      .from("ad_variations")
      .select("*")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: true });

    const aspectSucceeded = aspectResults.filter((r) => r.status === "succeeded").length;
    const aspectFailed = aspectResults.filter((r) => r.status === "failed").length;
    const anySuccess = hooks.length + captions.length + aspectSucceeded > 0;
    void sendJobStatusEmail({
      userId: uid,
      kind: "ad_render",
      status: anySuccess ? "completed" : "failed",
      jobId: batchId,
      title: data.brief.slice(0, 80),
      url: `https://auroraperformancestudio.com/jobs`,
      error: anySuccess ? undefined : `${aspectFailed} aspect renders failed`,
    });

    return {
      batchId,
      variations: (fullBatch ?? []) as AdVariationRow[],
      hookCount: hooks.length,
      captionCount: captions.length,
      aspectRenderCount: aspectSucceeded,
    };
  });

export const listAdVariationBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await adminDb
      .from("ad_variations")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    const byBatch = new Map<string, AdVariationRow[]>();
    for (const r of (data ?? []) as AdVariationRow[]) {
      const list = byBatch.get(r.batch_id) ?? [];
      list.push(r);
      byBatch.set(r.batch_id, list);
    }
    return {
      batches: Array.from(byBatch.entries()).map(([batchId, rows]) => ({
        batchId,
        createdAt: rows[rows.length - 1]?.created_at ?? new Date().toISOString(),
        rows,
      })),
    };
  });
