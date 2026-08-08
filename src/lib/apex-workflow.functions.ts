// Apex AI Orchestration Engine — runs a full ad-content workflow end to end
// from a single client call:
//   1. Shots       — music-synced multi-angle Locked-Likeness shoot (12 max)
//   2. Ad edits    — auto-generated hooks + captions + multi-aspect renders
//   3. Export      — a signed manifest listing every asset ready to download.
//
// Each stage is idempotent-per-batch and reports partial success so a single
// failing shot never poisons the whole run. The `workflowId` returned lines up
// with the `batch_id` used by `ad_variations` so the /jobs dashboard can group
// everything under one workflow.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runLikenessShoot, type ShootResult } from "@/lib/likeness-shoot.functions";
import { generateAdVariations, type AdVariationRow } from "@/lib/ad-variations.functions";
import { LIKENESS_MAX_SHOTS } from "@/lib/likeness-shoot";

const ApexSchema = z.object({
  likenessId: z.string().uuid(),
  wardrobe: z.string().min(4).max(500),
  scene: z.string().min(4).max(500),
  song: z.string().max(200).optional(),
  bpm: z.number().int().min(40).max(220).optional(),
  shotIds: z.array(z.string().min(1).max(60)).min(1).max(LIKENESS_MAX_SHOTS),
  /** Ad brief — feeds the hook/caption generator. */
  adBrief: z.string().min(4).max(600),
  aspects: z.array(z.enum(["1:1", "16:9"])).optional().default(["1:1", "16:9"]),
  includeText: z.boolean().optional().default(true),
});

export type ApexWorkflowResult = {
  workflowId: string;
  stages: {
    shots: { results: ShootResult[]; successCount: number };
    ads: {
      batchId: string;
      variations: AdVariationRow[];
      hookCount: number;
      captionCount: number;
      aspectRenderCount: number;
    } | null;
    export: {
      generatedAt: string;
      assets: Array<{
        stage: "shot" | "aspect_render";
        label: string;
        aspect?: string;
        url: string;
      }>;
      hooks: string[];
      captions: string[];
    };
  };
};

export const runApexWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ApexSchema.parse(d))
  .handler(async ({ data, context }): Promise<ApexWorkflowResult> => {
    const { sendJobStatusEmail } = await import("@/lib/job-notifications.server");
    const uid = context.userId;
    const runId = crypto.randomUUID();
    const title = data.adBrief.slice(0, 80);
    void sendJobStatusEmail({ userId: uid, kind: "orchestration", status: "queued", jobId: runId, title });
    void sendJobStatusEmail({ userId: uid, kind: "orchestration", status: "running", jobId: runId, title });

    try {
    // Stage 1: shots
    const shootOut = await runLikenessShoot({
      data: {
        likenessId: data.likenessId,
        wardrobe: data.wardrobe,
        scene: data.scene,
        song: data.song,
        bpm: data.bpm,
        shotIds: data.shotIds,
      },
    });
    const succeeded = shootOut.results.filter(
      (r): r is ShootResult & { url: string; generationId: string } =>
        r.status === "succeeded" && !!r.url,
    );

    // Stage 2: ad variations (only if we have at least one shot)
    let adsStage: ApexWorkflowResult["stages"]["ads"] = null;
    if (succeeded.length > 0) {
      adsStage = await generateAdVariations({
        data: {
          sourceUrls: succeeded.map((s) => s.url),
          sourceGenerationIds: succeeded.map((s) => s.generationId),
          brief: data.adBrief,
          includeText: data.includeText,
          includeAspectRenders: true,
          aspects: data.aspects,
          likenessId: data.likenessId,
          textCount: 5,
        },
      });
    }

    // Stage 3: export manifest
    const hooks =
      adsStage?.variations.filter((v) => v.kind === "hook").map((v) => v.text_value ?? "") ?? [];
    const captions =
      adsStage?.variations.filter((v) => v.kind === "caption").map((v) => v.text_value ?? "") ??
      [];
    const aspectAssets =
      adsStage?.variations
        .filter((v) => v.kind === "aspect_render" && v.status === "succeeded" && v.url)
        .map((v) => ({
          stage: "aspect_render" as const,
          label: `${v.aspect ?? ""} re-frame`,
          aspect: v.aspect ?? undefined,
          url: v.url as string,
        })) ?? [];

    const shotAssets = succeeded.map((s) => ({
      stage: "shot" as const,
      label: s.label,
      aspect: "9:16",
      url: s.url,
    }));

      const result: ApexWorkflowResult = {
        workflowId: adsStage?.batchId ?? runId,
        stages: {
          shots: { results: shootOut.results, successCount: succeeded.length },
          ads: adsStage,
          export: {
            generatedAt: new Date().toISOString(),
            assets: [...shotAssets, ...aspectAssets],
            hooks,
            captions,
          },
        },
      };
      void sendJobStatusEmail({
        userId: uid,
        kind: "orchestration",
        status: succeeded.length > 0 ? "completed" : "failed",
        jobId: result.workflowId,
        title,
        url: `https://auroraperformancestudio.com/jobs`,
        error: succeeded.length === 0 ? "No shots succeeded" : undefined,
      });
      return result;
    } catch (e) {
      void sendJobStatusEmail({
        userId: uid, kind: "orchestration", status: "failed", jobId: runId, title,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  });
