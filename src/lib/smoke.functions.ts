import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orchestrate } from "./orchestrator.server";

// Test fixtures (existing CDN assets)
const TEST_SELFIE_URL = "https://aurora-sparkle-charm.lovable.app/__l5e/assets-v1/24c6484d-42b7-4d6c-8d1d-aeeb71a19d30/josh-yellow-mic.jpg";
const TEST_AUDIO_URL  = "https://aurora-sparkle-charm.lovable.app/__l5e/assets-v1/04b233f7-4417-4708-a70a-761de327deef/the-one-hook.mp3";

const STEPS = [
  "Image gen",
  "Video gen",
  "Lip sync",
  "Canvas (workflow)",
  "UGC factory",
  "CLI (npm package)",
  "Colors studio",
  "Motion control",
] as const;

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin only");
}

type StepResult = {
  status: "pass" | "fail" | "skip";
  latency_ms: number;
  cost_usd: number;
  output_url?: string | null;
  error?: string | null;
  raw?: Record<string, unknown>;
};

async function runStep(fn: () => Promise<{ url?: string; cost?: number; raw?: Record<string, unknown> }>): Promise<StepResult> {
  const start = Date.now();
  try {
    const out = await fn();
    return {
      status: "pass",
      latency_ms: Date.now() - start,
      cost_usd: out.cost ?? 0,
      output_url: out.url ?? null,
      raw: out.raw,
    };
  } catch (e) {
    return {
      status: "fail",
      latency_ms: Date.now() - start,
      cost_usd: 0,
      error: e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500),
    };
  }
}

async function writeCheck(runId: string, step: number, name: string, result: StepResult) {
  await supabaseAdmin.from("smoke_checks").insert({
    run_id: runId,
    step,
    name,
    status: result.status,
    latency_ms: result.latency_ms,
    cost_usd: result.cost_usd,
    output_url: result.output_url ?? null,
    error: result.error ?? null,
    raw: (result.raw ?? null) as never,
  });
}

export const runSmokeTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: run, error } = await supabaseAdmin
      .from("smoke_runs")
      .insert({ triggered_by: context.userId })
      .select()
      .single();
    if (error || !run) throw new Error(error?.message || "Failed to start run");

    // Kick off in background — return immediately with run id
    (async () => {
      let total = 0;
      let imageUrl: string | null = null;
      let videoUrl: string | null = null;

      // 1. Image
      const r1 = await runStep(async () => {
        const out = await orchestrate({
          kind: "image",
          prompt: "smoke test: cinematic portrait of the subject, neutral studio lighting",
          imageUrls: [TEST_SELFIE_URL],
          model: "google/gemini-2.5-flash-image",
          userId: context.userId,
          refId: run.id,
        });
        imageUrl = out.url;
        return { url: out.url, cost: out.costUsd, raw: { provider: out.provider } };
      });
      await writeCheck(run.id, 1, STEPS[0], r1);
      total += r1.cost_usd;

      // 2. Video (only if image succeeded)
      const r2 = imageUrl ? await runStep(async () => {
        const out = await orchestrate({
          kind: "video",
          prompt: "smoke test: subtle head turn, cinematic",
          imageUrls: [imageUrl!],
          duration: 5,
          resolution: "480p",
          model: "kling-v2.1",
          userId: context.userId,
          refId: run.id,
        });
        videoUrl = out.url;
        return { url: out.url, cost: out.costUsd, raw: { provider: out.provider } };
      }) : { status: "skip" as const, latency_ms: 0, cost_usd: 0, error: "Skipped — image gen failed" };
      await writeCheck(run.id, 2, STEPS[1], r2);
      total += r2.cost_usd;

      // 3. Lipsync (only if video succeeded)
      const r3 = videoUrl ? await runStep(async () => {
        const out = await orchestrate({
          kind: "lipsync",
          videoUrl: videoUrl!,
          audioUrl: TEST_AUDIO_URL,
          model: "fal-ai/sync-lipsync/v2",
          userId: context.userId,
          refId: run.id,
        });
        return { url: out.url, cost: out.costUsd, raw: { provider: out.provider } };
      }) : { status: "skip" as const, latency_ms: 0, cost_usd: 0, error: "Skipped — video gen failed" };
      await writeCheck(run.id, 3, STEPS[2], r3);
      total += r3.cost_usd;

      // 4. Canvas — orchestrate a minimal image node (same code path Canvas uses)
      const r4 = await runStep(async () => {
        const out = await orchestrate({
          kind: "image",
          prompt: "smoke test: canvas node — moody portrait",
          imageUrls: [TEST_SELFIE_URL],
          model: "google/gemini-2.5-flash-image",
          userId: context.userId,
          refId: run.id,
        });
        return { url: out.url, cost: out.costUsd, raw: { provider: out.provider } };
      });
      await writeCheck(run.id, 4, STEPS[3], r4);
      total += r4.cost_usd;

      // 5. UGC — current impl is a stub (just inserts a row, doesn't call HeyGen yet)
      const r5: StepResult = {
        status: "skip",
        latency_ms: 0,
        cost_usd: 0,
        error: "UGC handler is a stub (generations row only). HeyGen call not wired yet.",
      };
      await writeCheck(run.id, 5, STEPS[4], r5);

      // 6. CLI — HEAD npm to see if @aurora-studio/cli is published
      const r6 = await runStep(async () => {
        const res = await fetch("https://registry.npmjs.org/@aurora-studio/cli", { method: "GET" });
        if (res.status === 404) throw new Error("@aurora-studio/cli not published to npm yet");
        if (!res.ok) throw new Error(`npm registry HTTP ${res.status}`);
        const body = await res.json() as { "dist-tags"?: { latest?: string } };
        return { url: `https://www.npmjs.com/package/@aurora-studio/cli`, cost: 0, raw: { latest: body["dist-tags"]?.latest ?? null } };
      });
      await writeCheck(run.id, 6, STEPS[5], r6);

      // 7. Colors — single-color cyclorama preset (image gen w/ colors-specific prompt)
      const r7 = await runStep(async () => {
        const out = await orchestrate({
          kind: "image",
          prompt: "smoke test: subject in front of a single-color saturated electric-blue cyclorama backdrop, studio lighting",
          imageUrls: [TEST_SELFIE_URL],
          model: "google/gemini-2.5-flash-image",
          userId: context.userId,
          refId: run.id,
        });
        return { url: out.url, cost: out.costUsd, raw: { provider: out.provider } };
      });
      await writeCheck(run.id, 7, STEPS[6], r7);
      total += r7.cost_usd;

      // 8. Motion control — Kling video gen with start+end frame interpolation
      const r8 = imageUrl ? await runStep(async () => {
        const out = await orchestrate({
          kind: "video",
          prompt: "smoke test: motion control — smooth interpolation between start and end frame, cinematic",
          imageUrls: [imageUrl!, imageUrl!], // start + end (same frame is a valid smoke check)
          duration: 5,
          resolution: "480p",
          model: "kling-v2.1",
          userId: context.userId,
          refId: run.id,
        });
        return { url: out.url, cost: out.costUsd, raw: { provider: out.provider, mode: "start+end-frame" } };
      }) : { status: "skip" as const, latency_ms: 0, cost_usd: 0, error: "Skipped — image gen failed" };
      await writeCheck(run.id, 8, STEPS[7], r8);
      total += r8.cost_usd;

      await supabaseAdmin
        .from("smoke_runs")
        .update({
          finished_at: new Date().toISOString(),
          total_cost_usd: total,
          summary: { passed: [r1, r2, r3, r4, r5, r6, r7, r8].filter(r => r.status === "pass").length, total: 8 } as never,
        })
        .eq("id", run.id);
    })().catch(async (e) => {
      await supabaseAdmin.from("smoke_runs").update({
        finished_at: new Date().toISOString(),
        summary: { error: e instanceof Error ? e.message : String(e) } as never,
      }).eq("id", run.id);
    });

    return { runId: run.id };
  });

export const getSmokeRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: run } = await supabaseAdmin.from("smoke_runs").select("*").eq("id", data.id).single();
    const { data: checks } = await supabaseAdmin.from("smoke_checks").select("*").eq("run_id", data.id).order("step", { ascending: true });
    return { run, checks: checks ?? [] };
  });

export const listSmokeRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin.from("smoke_runs").select("*").order("started_at", { ascending: false }).limit(20);
    return { runs: data ?? [] };
  });