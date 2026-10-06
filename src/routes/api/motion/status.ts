import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticatedUserId } from "@/lib/api-auth.server";

const JobIdSchema = z.string().uuid();

export const Route = createFileRoute("/api/motion/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await authenticatedUserId(request);
        if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const url = new URL(request.url);
        const parsedId = JobIdSchema.safeParse(url.searchParams.get("id"));
        if (!parsedId.success) {
          return Response.json({ error: "A valid job id is required" }, { status: 400 });
        }

        const jobId = parsedId.data;
        const { data: job, error: jobError } = await supabaseAdmin
          .from("jobs")
          .select("id, generation_id, kind, status, error, progress_pct, progress_stage, attempts, created_at")
          .eq("id", jobId)
          .eq("user_id", userId)
          .maybeSingle();
        if (jobError) return Response.json({ error: "Status unavailable" }, { status: 503 });

        const generationId = job?.generation_id ?? jobId;
        const { data: generation, error: generationError } = await supabaseAdmin
          .from("generations")
          .select("id, kind, status, error, result_image_url, result_video_url, model, created_at")
          .eq("id", generationId)
          .eq("user_id", userId)
          .maybeSingle();
        if (generationError) return Response.json({ error: "Status unavailable" }, { status: 503 });
        if (!job && !generation) return Response.json({ error: "Job not found" }, { status: 404 });

        return Response.json({ job, generation });
      },
    },
  },
});
