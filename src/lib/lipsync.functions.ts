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
    engine: z.enum(["sync-v2", "wav2lip", "latentsync", "xai-ugc"]).default("sync-v2"),
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
