// Worker progress callback — POST /api/public/workers/progress
// Lets a self-hosted GPU worker report REAL render progress for the job it is
// currently serving (task #284): Aurora passes `job_id` in the dispatch body,
// the worker POSTs {job_id, pct?, stage?} back here while it works.
//
// Auth: the SAME private operator secret as /workers/register — sent as the
// `apikey` header (or Bearer). Deliberately NOT the Supabase anon/publishable
// key (that ships to every browser), and deliberately NOT unauthenticated:
// spoofed progress is only cosmetic, but an open endpoint would still let
// anyone with a leaked job id vandalise a paying user's render UI. Workers
// already hold AURORA_REGISTER_SECRET for self-registration, so this adds
// zero new provisioning.
//
// The row update is fenced on status='processing' (see reportJobProgress), so
// a late/stale report can never touch a finalized job — worst case it nudges
// a cosmetic percent on an in-flight one.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Schema = z
  .object({
    job_id: z.string().uuid(),
    pct: z.number().min(0).max(100).optional(),
    stage: z.string().min(1).max(120).optional(),
  })
  .refine((d) => d.pct !== undefined || d.stage !== undefined, {
    message: "pct or stage required",
  });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/workers/progress")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = (process.env.AURORA_REGISTER_SECRET ?? "").trim();
        if (!expected) {
          // Fail closed — without the operator secret nothing can authenticate.
          return json({ error: "Progress reporting disabled: AURORA_REGISTER_SECRET is not configured" }, 503);
        }
        // Trim defensively (same rationale as the register route): a secret
        // pasted into Kaggle/Colab secrets UIs can pick up trailing whitespace.
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if ((apikey?.trim() ?? "") !== expected) {
          return json({ error: "Unauthorized" }, 401);
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        const parsed = Schema.safeParse(raw);
        if (!parsed.success) {
          return json(
            { error: parsed.error.issues.map((i) => i.message).join(", ") },
            400,
          );
        }

        const { reportJobProgress } = await import("@/lib/jobs.server");
        const matched = await reportJobProgress(parsed.data.job_id, {
          pct: parsed.data.pct,
          stage: parsed.data.stage,
        });
        // matched=false is benign by design: unknown job id, job already
        // finalized, or a sync-path ref that isn't a jobs row.
        return json({ ok: true, matched });
      },
    },
  },
});
