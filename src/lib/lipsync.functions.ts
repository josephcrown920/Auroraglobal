import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { runLipsyncJob } from "./lipsync.server";

export const startLipsync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    videoUrl: z.string().url(),
    audioUrl: z.string().url(),
    engine: z.enum(["sync-v2", "wav2lip"]).default("sync-v2"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    return runLipsyncJob({
      userId: context.userId,
      videoUrl: data.videoUrl,
      audioUrl: data.audioUrl,
      engine: data.engine,
    });
  });

export const getLipsyncJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { fetchLipsyncJob } = await import("./lipsync.server");
    return fetchLipsyncJob(data.id, context.userId);
  });
