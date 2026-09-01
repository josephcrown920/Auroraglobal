import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { routedGenerate } from "@/lib/ai-router";
import { enqueueJobForUser } from "@/lib/jobs.functions";
import { computeCost } from "@/lib/pricing";
import {
  BABY_AGENT_ANALYSIS,
  BABY_AGENT_SYSTEM,
  BabyPlanSchema,
  compileShotPrompt,
  chooseProvider,
  type AuroraBabyPlan,
} from "./aurora-baby-agent";

const AnalyzeInput = z.object({
  brief: z.string().trim().min(10).max(8000),
  durationSeconds: z.number().int().min(5).max(600).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "2.39:1"]).optional(),
});

const StartInput = z.object({
  brief: z.string().trim().min(10).max(8000),
  durationSeconds: z.number().int().min(5).max(600).optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:5", "2.39:1"]).optional(),
  referenceUrls: z.array(z.string().url()).max(6).default([]),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  autoGenerate: z.boolean().default(false),
});

type RunRow = {
  id: string;
  user_id: string;
  brief: string;
  plan: unknown;
  status: string;
  created_at: string;
  updated_at: string;
};

function runTable() {
  return (supabaseAdmin as unknown as {
    from: (table: string) => {
      insert: (value: Record<string, unknown>) => { select: (columns: string) => { single: () => Promise<{ data: RunRow | null; error: { message: string } | null }> } };
      update: (value: Record<string, unknown>) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => Promise<{ error: { message: string } | null }> } };
    };
  }).from("aurora_baby_agent_runs");
}

async function planBrief(brief: string, durationSeconds?: number, aspectRatio?: string): Promise<AuroraBabyPlan> {
  const output = await routedGenerate({
    system: BABY_AGENT_SYSTEM,
    prompt: `${BABY_AGENT_ANALYSIS}\n\nUSER BRIEF:\n${brief}\n\nHard constraints: ${durationSeconds ? `duration=${durationSeconds}s` : "duration=auto"}; ${aspectRatio ? `aspect=${aspectRatio}` : "aspect=auto"}.`,
    schema: BabyPlanSchema,
    category: "VIDEO_DIRECTION",
  });
  if (output.output.needsClarification) {
    throw new Error(output.output.question ?? "Aurora needs one more detail before it can direct this production.");
  }
  return BabyPlanSchema.parse(output.output);
}

export const analyzeAuroraBabyBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AnalyzeInput.parse(data))
  .handler(async ({ data }) => {
    const plan = await planBrief(data.brief, data.durationSeconds, data.aspectRatio);
    const available = {
      modelark: Boolean(process.env.ARK_API_KEY),
      fal: Boolean(process.env.FAL_KEY),
      replicate: Boolean(process.env.REPLICATE_API_TOKEN),
      vast: Boolean(process.env.VAST_API_KEY || process.env.VAST_API_URL),
    };
    const routes = plan.shots.map((shot) => ({ id: shot.id, provider: chooseProvider(shot, available) }));
    const estimatedCredits = Math.round(plan.shots.reduce((sum, shot) => sum + computeCost({
      features: ["video"],
      model: shot.preferredProvider === "modelark" ? "seedance-2.0" : "seedance-2.0-fast",
      durationSeconds: Math.min(15, Math.max(3, Math.round(shot.durationSeconds))),
      resolution: "720p",
    }).total, 0) * 100) / 100;
    return { plan, routes, estimatedCredits, availableProviders: available };
  });

export const startAuroraBabyProduction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StartInput.parse(data))
  .handler(async ({ data, context }) => {
    const plan = await planBrief(data.brief, data.durationSeconds, data.aspectRatio);
    const runId = crypto.randomUUID();
    const now = new Date().toISOString();
    const { data: run, error } = await runTable().insert({
      id: runId,
      user_id: context.userId,
      brief: data.brief,
      plan,
      status: "dispatching",
      created_at: now,
      updated_at: now,
    }).select("*").single();
    if (error || !run) throw new Error(error?.message ?? "Could not create Aurora Baby Agent run");

    if (!data.autoGenerate) {
      await runTable().update({ status: "planned", updated_at: new Date().toISOString() }).eq("id", runId).eq("user_id", context.userId);
      return { runId, status: "planned", plan, jobs: [] };
    }

    const available = {
      modelark: Boolean(process.env.ARK_API_KEY),
      fal: Boolean(process.env.FAL_KEY),
      replicate: Boolean(process.env.REPLICATE_API_TOKEN),
      vast: Boolean(process.env.VAST_API_KEY || process.env.VAST_API_URL),
    };

    const jobs: Array<{ shotId: string; provider: string; jobId: string; generationId: string; preview: boolean }> = [];
    for (const shot of plan.shots) {
      const provider = chooseProvider(shot, available);
      const model = provider === "modelark"
        ? (process.env.MODELARK_VIDEO_MODEL || "seedance-2.0")
        : provider === "fal"
          ? (process.env.AURORA_BABY_FAL_VIDEO_MODEL || "fal-ai/bytedance/seedance/v1/pro/image-to-video")
          : provider === "replicate"
            ? (process.env.AURORA_BABY_REPLICATE_VIDEO_MODEL || "bytedance/seedance-1-pro")
            : (process.env.AURORA_BABY_VAST_VIDEO_MODEL || "seedance-2.0");

      const queued = await enqueueJobForUser(context.userId, {
        kind: "video",
        prompt: `${compileShotPrompt(shot, plan)}\n\nMASTER SHOT PROMPT:\n${shot.prompt}\n\nNEGATIVE:\n${shot.negativePrompt}\n\nAGENT RUN: ${runId}\nSHOT: ${shot.id}`.slice(0, 2000),
        imageUrls: data.referenceUrls.length ? data.referenceUrls : undefined,
        duration: Math.max(3, Math.min(15, Math.round(shot.durationSeconds))),
        resolution: data.resolution,
        model,
        params: {
          auroraBabyAgent: true,
          runId,
          shotId: shot.id,
          scene: shot.scene,
          provider,
          aspectRatio: plan.brief.aspectRatio,
          continuityLocks: shot.continuityLocks,
          referenceRoles: shot.referenceRoles,
        },
      });
      jobs.push({ shotId: shot.id, provider, ...queued });
    }

    await runTable().update({ status: "queued", updated_at: new Date().toISOString() }).eq("id", runId).eq("user_id", context.userId);
    return { runId, status: "queued", plan, jobs };
  });
