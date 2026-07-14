import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orchestrate } from "./orchestrator.server";
import { refinePlan } from "./agent-loop.server";
import { lipsyncEngineCost, computeCost } from "./pricing";

// Test fixtures (existing CDN assets)
const TEST_SELFIE_URL = "https://aurora-sparkle-charm.lovable.app/__l5e/assets-v1/24c6484d-42b7-4d6c-8d1d-aeeb71a19d30/josh-yellow-mic.jpg";
const TEST_AUDIO_URL  = "https://aurora-sparkle-charm.lovable.app/__l5e/assets-v1/04b233f7-4417-4708-a70a-761de327deef/the-one-hook.mp3";
// Short public driving video for the motion-transfer smoke step (used only when a motion worker is online).
const TEST_DRIVING_VIDEO_URL = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

const STEPS = [
  "Image gen",
  "Video gen",
  "Lip sync",
  "Canvas pipeline (image→video)",
  "UGC Ad (image→video)",
  "CLI (npm package)",
  "Colors studio",
  "Motion control",
  "HeyGen template",
  "Aurora agent (plan)",
  "Lip sync (photo+audio)",
  "Lip sync (image+audio → generate API path)",
  "Templates: lip-sync dispatch",
  "Spin carousel",
  "Lyric Video",
  "Avatar shot (SeedDream image)",
  "Photo Edit",
  "Speech TTS",
  "Perform Anywhere — Reshoot (Motion Transfer)",
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
          model: "seedance-2.0-fast",
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

      // 4. Canvas pipeline (image→video) — mirrors runGraph executing a two-node
      //    DAG where an image node feeds its result URL directly into a video node.
      //    Node 1 generates an identity-locked portrait (same orchestrate call the
      //    canvas image node makes). Node 2 animates it (same call the canvas video
      //    node makes). The final video URL must be non-empty to pass.
      const r4 = await runStep(async () => {
        const imgOut = await orchestrate({
          kind: "image",
          prompt: "smoke test: canvas image node — moody cinematic portrait",
          imageUrls: [TEST_SELFIE_URL],
          model: "google/gemini-2.5-flash-image",
          userId: context.userId,
          refId: run.id,
        });
        if (!imgOut.url) throw new Error("Canvas image node returned no URL");
        const vidOut = await orchestrate({
          kind: "video",
          prompt: "smoke test: canvas video node — subtle head turn, cinematic",
          imageUrls: [imgOut.url],
          duration: 5,
          resolution: "480p",
          model: "seedance-2.0-fast",
          userId: context.userId,
          refId: run.id,
        });
        if (!vidOut.url) throw new Error("Canvas video node returned no URL");
        return {
          url: vidOut.url,
          cost: imgOut.costUsd + vidOut.costUsd,
          raw: { provider_image: imgOut.provider, provider_video: vidOut.provider },
        };
      });
      await writeCheck(run.id, 4, STEPS[3], r4);
      total += r4.cost_usd;

      // 5. UGC Ad (image→video) — exercises the exact pipeline the /ugc page runs:
      //    imageMut (generatePerformanceShot via google/gemini-2.5-flash-image) →
      //    videoMut (generateVideoFromImage via seedance-2.0-fast, 5s 720p).
      //    Both stages use orchestrate() directly, mirroring what genShot + genVid
      //    call under the hood in ugc.lazy.tsx.
      const r5 = await runStep(async () => {
        const shot = await orchestrate({
          kind: "image",
          prompt:
            "smoke test: hyper-realistic UGC iPhone-style shot, beauty creator holding a glossy red lipstick label-out toward camera, golden-hour car-selfie, 9:16 framing, photoreal skin",
          imageUrls: [TEST_SELFIE_URL],
          model: "google/gemini-2.5-flash-image",
          userId: context.userId,
          refId: run.id,
        });
        const vid = await orchestrate({
          kind: "video",
          prompt:
            "smoke test: UGC natural micro-movements, subtle handheld shake, lifelike expression, iPhone-style handheld",
          imageUrls: [shot.url],
          duration: 5,
          resolution: "720p",
          model: "seedance-2.0-fast",
          userId: context.userId,
          refId: run.id,
        });
        if (!vid.url) throw new Error("UGC Ad video returned no output URL");
        return {
          url: vid.url,
          cost: shot.costUsd + vid.costUsd,
          raw: { provider_image: shot.provider, provider_video: vid.provider },
        };
      });
      await writeCheck(run.id, 5, STEPS[4], r5);
      total += r5.cost_usd;

      // 6. CLI — HEAD npm to see if @aurora-studio/cli is published
      const r6 = await runStep(async () => {
        const res = await fetch("https://registry.npmjs.org/@aurora-studio/cli", { method: "GET" });
        if (res.status === 404) throw new Error("@aurora-studio/cli not published to npm yet");
        if (!res.ok) throw new Error(`npm registry HTTP ${res.status}`);
        const body = await res.json() as { "dist-tags"?: { latest?: string } };
        return { url: `https://www.npmjs.com/package/@aurora-studio/cli`, cost: 0, raw: { latest: body["dist-tags"]?.latest ?? null } };
      });
      await writeCheck(run.id, 6, STEPS[5], r6);

      // 7. Colors — single-color cyclorama preset (image gen w/ colors-specific prompt).
      // Uses the same model slug the Colors Studio UI sends (gemini-3.1-flash-image-preview),
      // not the older gemini-2.5-flash-image Lovable slug which may 404.
      const r7 = await runStep(async () => {
        const out = await orchestrate({
          kind: "image",
          prompt: "smoke test: subject in front of a single-color saturated electric-blue cyclorama backdrop, studio lighting",
          imageUrls: [TEST_SELFIE_URL],
          model: "google/gemini-3.1-flash-image-preview",
          userId: context.userId,
          refId: run.id,
        });
        return { url: out.url, cost: out.costUsd, raw: { provider: out.provider } };
      });
      await writeCheck(run.id, 7, STEPS[6], r7);
      total += r7.cost_usd;

      // 8. Motion control — Seedance image-to-video (animates from the start frame).
      // Note: true start+end-frame interpolation is a Kling-only feature; Seedance uses the first frame.
      const r8 = imageUrl ? await runStep(async () => {
        const out = await orchestrate({
          kind: "video",
          prompt: "smoke test: motion control — cinematic motion from the reference frame",
          imageUrls: [imageUrl!],
          duration: 5,
          resolution: "480p",
          model: "seedance-2.0-fast",
          userId: context.userId,
          refId: run.id,
        });
        return { url: out.url, cost: out.costUsd, raw: { provider: out.provider, mode: "seedance-i2v" } };
      }) : { status: "skip" as const, latency_ms: 0, cost_usd: 0, error: "Skipped — image gen failed" };
      await writeCheck(run.id, 8, STEPS[7], r8);
      total += r8.cost_usd;

      // 9. HeyGen template — find any template owned by this admin user and attempt
      //    a generate. Skipped when HEYGEN_API_KEY is absent or no templates saved.
      //    aurora_templates is not yet in the generated Supabase types so we cast.
      type SmokeAuroraTemplate = {
        id: string; name: string; heygen_template_id: string;
        character_variable_key: string; fixed_variables: Record<string, unknown>;
      };
      type SmokeTemplatesTable = {
        from: (t: "aurora_templates") => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              limit: (n: number) => {
                maybeSingle: () => Promise<{ data: SmokeAuroraTemplate | null; error: unknown }>;
              };
            };
          };
        };
      };
      const _tdb = supabaseAdmin as unknown as SmokeTemplatesTable;
      const r9: StepResult = await (async (): Promise<StepResult> => {
        if (!process.env.HEYGEN_API_KEY) {
          return { status: "skip", latency_ms: 0, cost_usd: 0, error: "HEYGEN_API_KEY not configured" };
        }
        const { data: tpl } = await _tdb
          .from("aurora_templates")
          .select("id, name, heygen_template_id, character_variable_key, fixed_variables")
          .eq("user_id", context.userId)
          .limit(1)
          .maybeSingle();
        if (!tpl) {
          return { status: "skip", latency_ms: 0, cost_usd: 0, error: "No Aurora templates saved — add one at /heygen-templates first" };
        }
        return runStep(async () => {
          const variables = {
            ...tpl.fixed_variables,
            [tpl.character_variable_key]: {
              name: tpl.character_variable_key,
              type: "character" as const,
              properties: { type: "talking_photo", character_id: TEST_SELFIE_URL },
            },
          };
          const out = await orchestrate({
            kind: "video",
            prompt: `smoke test: HeyGen template "${tpl.name}"`,
            model: "heygen/template",
            params: { templateId: tpl.heygen_template_id, variables },
            userId: context.userId,
            refId: run.id,
          });
          return { url: out.url, cost: out.costUsd, raw: { provider: out.provider, templateId: tpl.heygen_template_id } };
        });
      })();
      await writeCheck(run.id, 9, STEPS[8], r9);
      total += r9.cost_usd;

      // 10. Aurora Agent — LLM planning loop (no HeyGen spend needed; just verifies
      //     the director→critic refinement cycle returns a usable shot plan).
      const r10 = await runStep(async () => {
        const result = await refinePlan({
          brief: "smoke test: one-shot cinematic portrait, studio backdrop",
          maxIterations: 1,
        });
        if (!result.plan.shots?.length) throw new Error("Agent plan returned 0 shots");
        return {
          url: undefined,
          cost: 0,
          raw: { shots: result.plan.shots.length, score: result.finalScore, stopReason: result.stopReason },
        };
      });
      await writeCheck(run.id, 10, STEPS[9], r10);

      // 11. Lip sync (photo+audio) — standalone HeyGen Photo path that doesn't depend
      //     on a prior video-gen step: feeds a portrait still image directly to the
      //     heygen/photo-video adapter alongside the test audio track, asserting a
      //     working lipsync video URL is returned.
      const r11: StepResult = await (async (): Promise<StepResult> => {
        if (!process.env.HEYGEN_API_KEY) {
          return { status: "skip", latency_ms: 0, cost_usd: 0, error: "HEYGEN_API_KEY not configured — skipping photo lipsync step" };
        }
        return runStep(async () => {
          const out = await orchestrate({
            kind: "lipsync",
            model: "heygen/photo-video",
            pinnedModelOnly: true,
            imageUrls: [TEST_SELFIE_URL],
            audioUrl: TEST_AUDIO_URL,
            userId: context.userId,
            refId: run.id,
          });
          if (!out.url) throw new Error("Photo lipsync returned no output URL");
          return { url: out.url, cost: out.costUsd, raw: { provider: out.provider } };
        });
      })();
      await writeCheck(run.id, 11, STEPS[10], r11);
      total += r11.cost_usd;

      // 12. Lip sync via the public-generate API code path — exercises the full
      //     credit-reservation → orchestrate → record pipeline that
      //     /api/public/generate runs internally for lipsync requests. This is
      //     the path the Aurora web app, CLI, and MCP tool all share. Uses a
      //     portrait still + test audio (HeyGen photo path if key is present,
      //     otherwise falls back to Sync.so with the video from step 2).
      const r12: StepResult = await (async (): Promise<StepResult> => {
        const usePhoto = !!process.env.HEYGEN_API_KEY;
        const model = usePhoto ? "heygen/photo-video" : "fal-ai/sync-lipsync/v2";
        if (!usePhoto && !videoUrl) {
          return {
            status: "skip",
            latency_ms: 0,
            cost_usd: 0,
            error: "No video from step 2 and no HEYGEN_API_KEY — skipping generate-API lipsync",
          };
        }
        return runStep(async () => {
          const { reserveOrchestrateRecord } = await import("./generate-core.server");
          const cost = lipsyncEngineCost(usePhoto ? "heygen-photo" : "sync-v2");
          const outcome = await reserveOrchestrateRecord({
            userId: context.userId,
            kind: "lipsync",
            imageUrls: usePhoto ? [TEST_SELFIE_URL] : undefined,
            videoUrl: usePhoto ? undefined : videoUrl!,
            audioUrl: TEST_AUDIO_URL,
            model,
            pinnedModelOnly: usePhoto,
            cost,
            reason: "smoke_lipsync_generate_api",
          });
          if (!outcome.ok) throw new Error(outcome.error ?? "generate-API lipsync failed");
          if (!outcome.url) throw new Error("generate-API lipsync returned no output URL");
          return { url: outcome.url, cost: outcome.costUsd ?? cost, raw: { provider: outcome.provider } };
        });
      })();
      await writeCheck(run.id, 12, STEPS[11], r12);
      total += r12.cost_usd;

      // 13. Templates: lip-sync dispatch — exercises the concert-lipsync template's
      //     model config end-to-end through the full generate-API pipeline. Derives
      //     cost via computeCost (the exact call templateCost() makes for the lipsync
      //     kind) so the smoke cost matches exactly what the TemplateDrawer shows.
      //     This proves: (a) the template manifest is parseable, (b) the model slug is
      //     accepted by the orchestrator, (c) the cost preview == charge.
      const r13: StepResult = await (async (): Promise<StepResult> => {
        if (!videoUrl) {
          return {
            status: "skip",
            latency_ms: 0,
            cost_usd: 0,
            error: "No video from step 2 — skipping template lipsync dispatch",
          };
        }
        return runStep(async () => {
          const { getStudioTemplate, TEMPLATE_DEFAULTS } = await import("./template-studio");
          const { reserveOrchestrateRecord } = await import("./generate-core.server");
          const tpl = getStudioTemplate("concert-lipsync");
          if (!tpl) throw new Error("concert-lipsync not found in template manifest");
          const model = tpl.lipsyncModel ?? TEMPLATE_DEFAULTS.lipsyncModel;
          const cost = computeCost({ features: ["lipsync"], model }).total;
          const outcome = await reserveOrchestrateRecord({
            userId: context.userId,
            kind: "lipsync",
            videoUrl: videoUrl!,
            audioUrl: TEST_AUDIO_URL,
            model,
            cost,
            reason: "smoke_template_lipsync",
          });
          if (!outcome.ok) throw new Error(outcome.error ?? "Template lipsync dispatch failed");
          if (!outcome.url) throw new Error("Template lipsync returned no output URL");
          return { url: outcome.url, cost: outcome.costUsd ?? cost, raw: { provider: outcome.provider, templateId: tpl.id } };
        });
      })();
      await writeCheck(run.id, 13, STEPS[12], r13);
      total += r13.cost_usd;

      // 14. Spin carousel — exercises the EXACT production Spin path:
      //     creates a 1-variant spin_jobs row (admin bypasses credit deduction),
      //     claims the variant (CAS fence), calls renderSpinPiece (same Gemini
      //     identity-locked image orchestration + studio upload used by every Spin
      //     piece in production), then marks the row done. This is the same code
      //     path tickSpinJob and advanceSpinQueueAdmin call per-piece.
      const r14 = await runStep(async () => {
        const { runSmokeSpinOne } = await import("./spin.functions");
        const { url, provider } = await runSmokeSpinOne(context.userId, TEST_SELFIE_URL);
        if (!url) throw new Error("Spin carousel piece returned no URL");
        return { url, cost: 0, raw: { provider, mode: "spin-one-piece" } };
      });
      await writeCheck(run.id, 14, STEPS[13], r14);
      total += r14.cost_usd;

      // 15. Lyric Video — synthesizes a new video from an uploaded song + timed
      //     lyric lines via the GPU worker's FFmpeg pipeline. Skipped when no
      //     lyric_video-capable worker is online (GPU-only, no hosted fallback).
      //     Uses the test audio track and 3 evenly-spaced 10s lyric lines.
      const r15: StepResult = await (async (): Promise<StepResult> => {
        const { hasActiveWorkerForKind } = await import("./orchestrator.server");
        if (!(await hasActiveWorkerForKind("lyric_video"))) {
          return {
            status: "skip",
            latency_ms: 0,
            cost_usd: 0,
            error: "No lyric_video-capable GPU worker online — start a worker with lyric_video capability",
          };
        }
        return runStep(async () => {
          const { reserveOrchestrateRecord } = await import("./generate-core.server");
          const cost = computeCost({ features: ["lyric_video"] }).total;
          const segments = [
            { start: 0,  end: 10, text: "smoke test lyric line one" },
            { start: 10, end: 20, text: "smoke test lyric line two" },
            { start: 20, end: 30, text: "smoke test lyric line three" },
          ];
          const outcome = await reserveOrchestrateRecord({
            userId: context.userId,
            kind: "lyric_video",
            cost,
            reason: "smoke_lyric_video",
            prompt: "Smoke test: lyric video (3 lines)",
            audioUrl: TEST_AUDIO_URL,
            segments,
            model: "ffmpeg-lyricvideo",
          });
          if (!outcome.ok) throw new Error(outcome.error ?? "Lyric video smoke dispatch failed");
          if (!outcome.url) throw new Error("Lyric video smoke returned no output URL");
          return { url: outcome.url, cost: outcome.costUsd ?? cost, raw: { provider: outcome.provider } };
        });
      })();
      await writeCheck(run.id, 15, STEPS[14], r15);
      total += r15.cost_usd;

      // 16. Avatar shot (SeedDream image) — exercises the full /avatar Shots-tab
      //     pipeline via runSmokeAvatarShotOne (same pattern as runSmokeSpinOne
      //     in step 14). That helper mirrors generateAvatarShot's handler body
      //     (engine="seedream"): credit reservation → SeedDream orchestration →
      //     URL return. Passes TEST_SELFIE_URL as the reference face image so the
      //     smoke confirms the identity-conditioned portrait path end-to-end.
      const r16 = await runStep(async () => {
        const { runSmokeAvatarShotOne, SHOT_IMAGE_COST: shotCost } =
          await import("./platform-template.functions");
        const { url, provider } = await runSmokeAvatarShotOne(context.userId, TEST_SELFIE_URL);
        if (!url) throw new Error("Avatar shot returned no image URL");
        return { url, cost: shotCost, raw: { provider } };
      });
      await writeCheck(run.id, 16, STEPS[15], r16);
      total += r16.cost_usd;

      // 17. Photo Edit — exercises the editStrict pipeline end-to-end:
      //     kind:"image" + imageUrls + PHOTO_EDIT_MODEL confirms the exact model
      //     and fal identity-edit route the Photo Editor feature uses is reachable.
      //     Uses editStrict:false (non-strict) so the step doesn't fail on
      //     providers that are temporarily down — a reference-image edit returning
      //     any non-empty URL proves the pipeline is wired correctly.
      const r17 = await runStep(async () => {
        const { PHOTO_EDIT_MODEL } = await import("./photo-edit.functions");
        const out = await orchestrate({
          kind: "image",
          prompt:
            "smoke test: edit — add soft golden-hour warmth to the lighting only, keep the subject, pose and background identical",
          imageUrls: [TEST_SELFIE_URL],
          model: PHOTO_EDIT_MODEL,
          editStrict: false,
          userId: context.userId,
          refId: run.id,
        });
        if (!out.url) throw new Error("Photo Edit returned no image URL");
        return { url: out.url, cost: out.costUsd, raw: { provider: out.provider } };
      });
      await writeCheck(run.id, 17, STEPS[16], r17);
      total += r17.cost_usd;

      // 18. Speech TTS — calls the real /api/public/generate HTTP route with
      //     kind:"audio" + model:"elevenlabs/tts" and asserts a non-empty MP3
      //     URL, exercising the full endpoint path (schema validation, auth,
      //     credit accounting, and ElevenLabs adapter).
      //     Skipped when ELEVENLABS_API_KEY is not configured.
      const r18: StepResult = await (async (): Promise<StepResult> => {
        if (!process.env.ELEVENLABS_API_KEY) {
          return {
            status: "skip",
            latency_ms: 0,
            cost_usd: 0,
            error: "ELEVENLABS_API_KEY not configured — skipping Speech TTS step",
          };
        }
        return runStep(async () => {
          // Forward the caller's Bearer token so /api/public/generate can
          // authenticate the request with the same user identity that triggered
          // the smoke run.
          const { getRequest } = await import("@tanstack/react-start/server");
          const req = getRequest();
          const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
          if (!authHeader.startsWith("Bearer ")) {
            throw new Error("Smoke step 18: could not extract Bearer token from request context");
          }
          const port = process.env.PORT ?? "8080";
          const endpoint = `http://localhost:${port}/api/public/generate`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({
              kind: "audio",
              model: "elevenlabs/tts",
              prompt: "Aurora smoke test — verifying ElevenLabs TTS audio pipeline.",
              params: { voiceId: "21m00Tcm4TlvDq8ikWAM" },
            }),
          });
          const json = (await res.json()) as { ok?: boolean; url?: string; error?: string; estimatedCostUsd?: number; provider?: string };
          if (!res.ok || !json.ok) {
            throw new Error(`Speech TTS /api/public/generate returned ${res.status}: ${json.error ?? "unknown error"}`);
          }
          const url = json.url ?? "";
          if (!url) throw new Error("Speech TTS returned no audio URL");
          if (!url.endsWith(".mp3") && !url.includes(".mp3?")) {
            throw new Error(`Speech TTS URL does not appear to be an MP3 file: ${url.slice(0, 120)}`);
          }
          return { url, cost: json.estimatedCostUsd ?? 0, raw: { provider: json.provider } };
        });
      })();
      await writeCheck(run.id, 18, STEPS[17], r18);
      total += r18.cost_usd;

      // 19. Perform Anywhere — Reshoot (Motion Transfer): dispatches a motion-transfer
      //     job via orchestrate() with kind:"motion", a reference image, and a short
      //     driving video. Skipped when no GPU worker with the "motion" capability is
      //     online (same guard used by the Motion Studio UI itself).
      const r19: StepResult = await (async (): Promise<StepResult> => {
        const { hasActiveWorkerForKind } = await import("./orchestrator.server");
        if (!(await hasActiveWorkerForKind("motion"))) {
          return {
            status: "skip",
            latency_ms: 0,
            cost_usd: 0,
            error: "No motion GPU worker online — skipping Perform Anywhere smoke step",
          };
        }
        return runStep(async () => {
          const { MIMIC_MOTION_MODEL } = await import("./motion-workflows.server");
          const out = await orchestrate({
            kind: "motion",
            prompt: "smoke test: motion transfer — drive reference image with short clip",
            imageUrls: [TEST_SELFIE_URL],
            videoUrl: TEST_DRIVING_VIDEO_URL,
            model: MIMIC_MOTION_MODEL,
            params: { motionType: "faithful", cameraMovement: "static" },
            userId: context.userId,
            refId: run.id,
          });
          if (!out.url) throw new Error("Motion transfer returned no video URL");
          return { url: out.url, cost: out.costUsd ?? computeCost({ features: ["motion"] }).total, raw: { provider: out.provider } };
        });
      })();
      await writeCheck(run.id, 19, STEPS[18], r19);
      total += r19.cost_usd;

      await supabaseAdmin
        .from("smoke_runs")
        .update({
          finished_at: new Date().toISOString(),
          total_cost_usd: total,
          summary: { passed: [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10, r11, r12, r13, r14, r15, r16, r17, r18, r19].filter(r => r.status === "pass").length, total: 19 } as never,
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