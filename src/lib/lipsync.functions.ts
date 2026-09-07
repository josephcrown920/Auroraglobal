import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { runLipsyncJob } from "./lipsync.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { LEGAL_VERSION } from "./legal";

export const startLipsync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    videoUrl: z.string().url(),
    audioUrl: z.string().url(),
    // Default to the registered GPU worker path. fal.ai is not required for
    // the standard lip-sync flow; LatentSync is self-hosted and free of hosted
    // API balance requirements.
    engine: z.enum(["sync-v2", "wav2lip", "latentsync", "xai-ugc", "heygen-photo"]).default("latentsync"),
    imageUrl: z.string().url().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    // Record the consent acknowledgement BEFORE the render runs, so a dispute
    // can always be traced back to a persisted, timestamped confirmation —
    // never just a client-side checkbox that leaves no server record.
    const { error: consentErr } = await supabaseAdmin.from("consent_logs").insert({
      user_id: context.userId,
      tool: "lipsync",
      policy_version: LEGAL_VERSION,
    });
    if (consentErr) throw new Error(`Consent could not be recorded: ${consentErr.message}`);

    return runLipsyncJob({
      userId: context.userId,
      videoUrl: data.videoUrl,
      audioUrl: data.audioUrl,
      engine: data.engine,
      imageUrl: data.imageUrl,
    });
  });

export const getLipsyncJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { fetchLipsyncJob } = await import("./lipsync.server");
    return fetchLipsyncJob(data.id, context.userId);
  });

// Batch Lip Sync — same photo/audio upload flow as startLipsync, but takes N
// source photos + ONE shared audio track and fans out into N independent
// lipsync_jobs rows (grouped by batch_id). See lipsync.server.ts for the
// per-photo charge/refund guarantees this reuses unchanged.
export const startBatchLipsync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    sourceUrls: z.array(z.string().url()).min(2).max(8),
    audioUrl: z.string().url(),
    engine: z.enum(["sync-v2", "wav2lip", "latentsync", "xai-ugc", "heygen-photo"]).default("heygen-photo"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error: consentErr } = await supabaseAdmin.from("consent_logs").insert({
      user_id: context.userId,
      tool: "batch_lipsync",
      policy_version: LEGAL_VERSION,
    });
    if (consentErr) throw new Error(`Consent could not be recorded: ${consentErr.message}`);

    const { runBatchLipsyncJob } = await import("./lipsync.server");
    return runBatchLipsyncJob({
      userId: context.userId,
      sourceUrls: data.sourceUrls,
      audioUrl: data.audioUrl,
      engine: data.engine,
    });
  });
