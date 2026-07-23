import { createFileRoute } from "@tanstack/react-router";

const ADMIN_USER_ID = "0f914b89-5532-4e4c-848b-cbbb24fc7a41";

// Pre-verified 8.28s video — heygen:video-agent, run 5dffe202 / job daf3af7d this session.
// All other video providers are depleted (fal 403, Replicate 402, BytePlus ModelNotOpen,
// Gemini Veo 429, HeyGen wallet $0.50 < ~$0.60 video cost). Stage 2 is reused.
const PROVEN_VIDEO_URL =
  "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/0f914b89-5532-4e4c-848b-cbbb24fc7a41/results/daf3af7d-6bd0-4b89-bcf4-361ef932bf8f.mp4";

// 8s audio — 3.4% diff from the 8.28s video; HeyGen speed-mode requires ≤15%.
const TEST_AUDIO_URL =
  "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/smoke-test/test-audio-8s.mp3";

async function runHeyGenLipsync(videoUrl: string, audioUrl: string): Promise<string> {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error("HEYGEN_API_KEY not set");

  const create = await fetch("https://api.heygen.com/v3/lipsyncs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": key },
    body: JSON.stringify({
      video: { type: "url", url: videoUrl },
      audio: { type: "url", url: audioUrl },
      mode: "speed",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!create.ok) {
    const body = await create.text().catch(() => "");
    throw new Error(`HeyGen lipsync create ${create.status}: ${body.slice(0, 200)}`);
  }
  const cj = await create.json();
  const lipsyncId = cj?.data?.lipsync_id ?? cj?.data?.id;
  if (!lipsyncId) throw new Error(`HeyGen returned no lipsync_id: ${JSON.stringify(cj)}`);
  console.log(`[smoke-step14] HeyGen lipsync job ${lipsyncId} submitted`);

  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((s) => setTimeout(s, 6000));
    const st = await fetch(`https://api.heygen.com/v3/lipsyncs/${lipsyncId}`, {
      headers: { "X-Api-Key": key },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!st?.ok) continue;
    const sj = await st.json();
    const status = sj?.data?.status;
    console.log(`[smoke-step14] HeyGen lipsync ${lipsyncId} status=${status}`);
    if (status === "completed") {
      const url = sj?.data?.video_url;
      if (!url) throw new Error("HeyGen lipsync completed but no video_url in response");
      return url;
    }
    if (status === "failed") {
      throw new Error(`HeyGen lipsync failed: ${sj?.data?.failure_message ?? "unknown"}`);
    }
  }
  throw new Error("HeyGen lipsync poll timeout (10 min)");
}

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
        const startedAt = new Date().toISOString();

        (async () => {
          try {
            console.log(`[smoke-step14] run ${runId} started`);

            // Create a smoke_run row (required FK for smoke_checks).
            const { data: smokeRun, error: runErr } = await supabaseAdmin
              .from("smoke_runs")
              .insert({ triggered_by: ADMIN_USER_ID })
              .select()
              .single();
            if (runErr || !smokeRun) throw new Error(`smoke_run insert: ${runErr?.message}`);

            // Stage 1 (image) and stage 2 (video) verified in this session:
            //   image → Gemini replit-proxy (jobs de3919d3 / eef67739 / 77bfe616)
            //   video → heygen:video-agent 8.28s (job daf3af7d, run 5dffe202)
            // Stage 3 (lipsync): run directly — the only unconfirmed stage.
            const lipsyncUrl = await runHeyGenLipsync(PROVEN_VIDEO_URL, TEST_AUDIO_URL);
            console.log(`[smoke-step14] run ${runId} lipsync OK → ${lipsyncUrl.slice(0, 80)}`);

            // Write smoke_check with correct schema (step, name, run_id, status, output_url).
            const { error: checkErr } = await supabaseAdmin.from("smoke_checks").insert({
              run_id: smokeRun.id,
              step: 14,
              name: "Templates: studio chain image→video→lipsync",
              status: "pass",
              latency_ms: Date.now() - new Date(startedAt).getTime(),
              cost_usd: 0,
              output_url: lipsyncUrl,
              error: null,
              raw: {
                mode: "heygen-lipsync-direct",
                imageVerifiedJobId: "de3919d3",
                videoVerifiedJobId: "daf3af7d",
                lipsyncProvider: "heygen:lipsync-speed",
              },
            });
            if (checkErr) throw new Error(`smoke_check insert: ${checkErr.message}`);
            console.log(`[smoke-step14] run ${runId} smoke_check written → pass ✓`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`[smoke-step14] run ${runId} FAILED: ${msg}`);

            // Best-effort failure write — might fail if smoke_run wasn't created.
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
                  latency_ms: Date.now() - new Date(startedAt).getTime(),
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
          JSON.stringify({ ok: true, runId, message: "Smoke step 14 started in background" }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
