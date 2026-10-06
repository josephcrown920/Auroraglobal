import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

async function authenticatedUserId(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(header.slice(7));
  return error ? null : (data.user?.id ?? null);
}

export const Route = createFileRoute("/api/jobs/$id/status")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const parsedId = z.string().uuid().safeParse(params.id);
        if (!parsedId.success) {
          return Response.json({ error: "Invalid job id" }, { status: 400 });
        }
        const userId = await authenticatedUserId(request);
        if (!userId) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: job, error: jobError } = await supabaseAdmin
          .from("jobs")
          .select("id, generation_id, kind, status, error, progress_pct, progress_stage")
          .eq("id", parsedId.data)
          .eq("user_id", userId)
          .maybeSingle();
        if (jobError) return Response.json({ error: "Status unavailable" }, { status: 503 });

        const generationId = job?.generation_id ?? parsedId.data;
        const { data: generation, error: generationError } = await supabaseAdmin
          .from("generations")
          .select("id, kind, status, error, result_image_url, result_video_url")
          .eq("id", generationId)
          .eq("user_id", userId)
          .maybeSingle();
        if (generationError) {
          return Response.json({ error: "Status unavailable" }, { status: 503 });
        }
        if (!job && !generation) {
          return Response.json({ error: "Job not found" }, { status: 404 });
        }
        return Response.json({ job, generation });
      },
    },
  },
});