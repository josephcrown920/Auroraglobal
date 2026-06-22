import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orchestrate } from "./orchestrator.server";

type Engine = "sync-v2" | "wav2lip";

const MODEL: Record<Engine, string> = {
  "sync-v2": "fal-ai/sync-lipsync/v2",
  "wav2lip": "fal-ai/wav2lip",
};

export async function runLipsyncJob(opts: {
  userId: string;
  videoUrl: string;
  audioUrl: string;
  engine: Engine;
}) {
  const { data: row, error: insertErr } = await supabaseAdmin
    .from("lipsync_jobs")
    .insert({
      user_id: opts.userId,
      video_url: opts.videoUrl,
      audio_url: opts.audioUrl,
      engine: opts.engine,
      status: "running",
    })
    .select("id")
    .single();
  if (insertErr || !row) throw new Error(insertErr?.message ?? "Failed to create job");

  try {
    const out = await orchestrate({
      kind: "lipsync",
      model: MODEL[opts.engine],
      videoUrl: opts.videoUrl,
      audioUrl: opts.audioUrl,
      userId: opts.userId,
      refId: row.id,
    });
    await supabaseAdmin
      .from("lipsync_jobs")
      .update({ status: "done", result_url: out.url })
      .eq("id", row.id);
    return { id: row.id, status: "done" as const, resultUrl: out.url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
      .from("lipsync_jobs")
      .update({ status: "error", error: msg.slice(0, 500) })
      .eq("id", row.id);
    return { id: row.id, status: "error" as const, error: msg };
  }
}

export async function fetchLipsyncJob(id: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("lipsync_jobs")
    .select("id,status,result_url,error,engine")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  return data;
}
