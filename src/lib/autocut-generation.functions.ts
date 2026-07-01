// AutoCut server functions: upload-URL vending + job creation.
// Follows the ugc-generation.functions.ts pattern exactly.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { COST_AUTOCUT, createAutocutUploadUrl, signedAutocutUrl } from "./autocut.server";
import type { GenerateKind } from "./orchestrator.server";

// Re-export the shared generation-status poller.
export { getGenerationStatus } from "./ugc-generation.functions";

// ─── Job-stage poller for the 4-step progress indicator ─────────────────────
// Reads the worker's `workerStage` field from the job payload (written by the
// worker as it progresses through analysis → assembly) and falls back to
// `locked_by IS NOT NULL` as a proxy for "worker is active".

export const getAutocutJobStage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: job } = await supabaseAdmin
      .from("jobs")
      .select("status, locked_by, payload")
      .eq("id", data.jobId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!job) return { stage: "analysing" as const };

    const workerStage = (job.payload as Record<string, unknown> | null)?.workerStage as
      | string
      | undefined;
    if (workerStage === "rendering") return { stage: "rendering" as const };
    if (workerStage === "assembling" || job.locked_by) return { stage: "assembling" as const };
    return { stage: "analysing" as const };
  });

export const AUTOCUT_MAX_CLIPS = 10;

// ─── 1. Signed upload URLs ───────────────────────────────────────────────────
// The client uploads each clip directly to Supabase storage using the returned
// signed PUT URL, then passes the `path` list to createAutocutJob.

export const getAutocutUploadUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        files: z
          .array(
            z.object({
              name: z.string().max(200),
              ext: z.string().max(10),
            }),
          )
          .min(1)
          .max(AUTOCUT_MAX_CLIPS),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const results: Array<{ signedUrl: string; token: string; path: string }> = [];
    const ts = Date.now();
    for (let i = 0; i < data.files.length; i++) {
      const f = data.files[i];
      const safeExt = f.ext.replace(/[^a-z0-9]/gi, "").slice(0, 6) || "mp4";
      const path = `${userId}/autocut/${ts}-clip-${i}.${safeExt}`;
      const signed = await createAutocutUploadUrl(path);
      if (!signed) throw new Error(`Could not create upload URL for clip ${i + 1}`);
      results.push({ signedUrl: signed.signedUrl, token: signed.token, path });
    }
    return results;
  });

// ─── 2. Create the autocut job ───────────────────────────────────────────────
// Signs download URLs for the uploaded paths (1-hour expiry; jobs are processed
// within minutes in normal operation) and enqueues via create_generation_and_reserve.

export const createAutocutJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        clipPaths: z.array(z.string().max(500)).min(1).max(AUTOCUT_MAX_CLIPS),
        style: z.enum(["hype", "cinematic", "talking_head", "tiktok_hook"]),
        musicTrackId: z.string().max(60).optional(),
        aspect: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    // Ownership check: every path must be under the caller's autocut namespace.
    const expected = `${userId}/autocut/`;
    const illegal = data.clipPaths.find((p) => !p.startsWith(expected));
    if (illegal) throw new Error("Clip path not owned by user");

    // Sign each uploaded path so the job runner can fetch them.
    const clipSignedUrls = await Promise.all(
      data.clipPaths.map((p) => signedAutocutUrl(p, 3600)),
    );
    const missingIdx = clipSignedUrls.findIndex((u) => !u);
    if (missingIdx >= 0) {
      throw new Error(
        `Could not sign clip ${missingIdx + 1} for processing — upload may have failed`,
      );
    }

    const client = supabaseAdmin as unknown as {
      rpc: (
        n: string,
        a: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: out, error } = await client.rpc("create_generation_and_reserve", {
      _user: userId,
      _kind: "autocut" as GenerateKind,
      _prompt: `autocut:${data.style}`,
      _amount: COST_AUTOCUT,
      _payload: {
        clipUrls: clipSignedUrls as string[],
        clipPaths: data.clipPaths,
        style: data.style,
        musicTrackId: data.musicTrackId ?? null,
        aspect: data.aspect,
      },
    });
    if (error) {
      if (/insufficient_credits/i.test(error.message)) throw new Error("Not enough Aura");
      throw new Error(error.message);
    }
    const row = Array.isArray(out) ? out[0] : out;
    return {
      jobId: (row as { job_id: string }).job_id,
      generationId: (row as { generation_id: string }).generation_id,
    };
  });
