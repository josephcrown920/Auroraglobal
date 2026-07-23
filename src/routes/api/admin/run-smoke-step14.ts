import { createFileRoute } from "@tanstack/react-router";

const ADMIN_USER_ID = "0f914b89-5532-4e4c-848b-cbbb24fc7a41";

// Same constants as smoke.functions.ts — kept in sync manually.
const TEST_SELFIE_URL =
  "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/smoke-test/test-selfie.jpg";
// 8s audio trimmed from the original — within 15% of the ~8s HeyGen avatar video.
const TEST_AUDIO_URL =
  "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/smoke-test/test-audio-8s.mp3";

export const Route = createFileRoute("/api/admin/run-smoke-step14")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const adminPass = process.env.ADMIN_PASSCODE ?? "";
        const token = request.headers.get("x-aurora-admin") ?? "";
        if (!adminPass || token !== adminPass) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const runId = crypto.randomUUID();
        const startedAt = Date.now();

        (async () => {
          try {
            console.log(`[smoke-step14] run ${runId} started`);

            // Create a smoke_run row (required FK for smoke_checks).
            const { data: smokeRun, error: runErr } = await supabaseAdmin
              .from("smoke_runs")
              .insert({ triggered_by: ADMIN_USER_ID })
              .select()
              .single();
            if (runErr || !smokeRun)
              throw new Error(`smoke_run insert: ${runErr?.message}`);

            // ── Canonical step-14 chain ──────────────────────────────────────
            // Calls the SAME runSmokeStudioChain function used by runSmokeTest.
            // Exercises: image→video→lipsync via reserveGenerationJob + awaitSmokeJob,
            // with the real orchestrator fallback chain (heygen/video-agent for video,
            // heygen lipsync for sync.so-exhausted fallback).
            const { runSmokeStudioChain } = await import(
              "@/lib/studio.functions"
            );
            const { url: lipsyncUrl, cost } = await runSmokeStudioChain(
              ADMIN_USER_ID,
              TEST_SELFIE_URL,
              TEST_AUDIO_URL,
            );
            console.log(
              `[smoke-step14] run ${runId} chain OK cost=${cost} url=${lipsyncUrl.slice(0, 80)}`,
            );

            const { error: checkErr } = await supabaseAdmin
              .from("smoke_checks")
              .insert({
                run_id: smokeRun.id,
                step: 14,
                name: "Templates: studio chain image→video→lipsync",
                status: "pass",
                latency_ms: Date.now() - startedAt,
                cost_usd: cost,
                output_url: lipsyncUrl,
                error: null,
                raw: { mode: "canonical-studio-chain", adminRunId: runId },
              });
            if (checkErr)
              throw new Error(`smoke_check insert: ${checkErr.message}`);

            console.log(
              `[smoke-step14] run ${runId} smoke_check written → pass ✓`,
            );
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : String(err);
            console.error(`[smoke-step14] run ${runId} FAILED: ${msg}`);

            try {
              const { data: failRun } = await supabaseAdmin
                .from("smoke_runs")
                .insert({ triggered_by: ADMIN_USER_ID })
                .select()
                .single();
              if (failRun) {
                await supabaseAdmin.from("smoke_checks").insert({
                  run_id: failRun.id,
                  step: 14,
                  name: "Templates: studio chain image→video→lipsync",
                  status: "fail",
                  latency_ms: Date.now() - startedAt,
                  cost_usd: 0,
                  output_url: null,
                  error: msg,
                  raw: null,
                });
              }
            } catch (_) { /* silent */ }
          }
        })();

        return new Response(
          JSON.stringify({
            ok: true,
            runId,
            message:
              "Smoke step 14 canonical chain started in background (image→video→lipsync via runSmokeStudioChain)",
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
