import { createFileRoute } from "@tanstack/react-router";
import {
  preflightImageFixture,
  TEST_AUDIO_URL,
  TEST_SELFIE_URL,
} from "@/lib/smoke-fixtures.server";

const ADMIN_USER_ID = "0f914b89-5532-4e4c-848b-cbbb24fc7a41";

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
          // Create the smoke_run row upfront so both pass and fail paths write
          // to the same run — operators can look up a single runId for the outcome.
          const { data: smokeRun, error: runErr } = await supabaseAdmin
            .from("smoke_runs")
            .insert({ triggered_by: ADMIN_USER_ID })
            .select()
            .single();
          if (runErr || !smokeRun) {
            console.error(
              `[smoke-step14] smoke_run insert failed: ${runErr?.message}`,
            );
            return;
          }

          try {
            console.log(
              `[smoke-step14] run ${runId} (smoke_run ${smokeRun.id}) started`,
            );
            await preflightImageFixture(TEST_SELFIE_URL);

            // Calls the SAME runSmokeStudioChain function used by runSmokeTest.
            // Exercises: image→video→lipsync via reserveGenerationJob + awaitSmokeJob.
            // Returns the actual model keys written to each generation row by the
            // orchestrator (observed winner, not just the requested template model).
            const { runSmokeStudioChain } = await import(
              "@/lib/studio.functions"
            );
            const { url: lipsyncUrl, cost, videoModelUsed, lipsyncModelUsed } =
              await runSmokeStudioChain(
                ADMIN_USER_ID,
                TEST_SELFIE_URL,
                TEST_AUDIO_URL,
              );
            console.log(
              `[smoke-step14] run ${runId} chain OK cost=${cost} videoModel=${videoModelUsed} lipsyncModel=${lipsyncModelUsed} url=${lipsyncUrl.slice(0, 80)}`,
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
                raw: {
                  mode: "canonical-studio-chain",
                  adminRunId: runId,
                  videoModelUsed,
                  lipsyncModelUsed,
                },
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

            // Write fail status to the SAME smoke_run row created above.
            try {
              await supabaseAdmin.from("smoke_checks").insert({
                run_id: smokeRun.id,
                step: 14,
                name: "Templates: studio chain image→video→lipsync",
                status: "fail",
                latency_ms: Date.now() - startedAt,
                cost_usd: 0,
                output_url: null,
                error: msg,
                raw: null,
              });
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
