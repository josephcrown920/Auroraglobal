import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const SPIN_PIECES = [
  "9:16 TikTok hook", "Reels cold-open", "YouTube Short", "X video post",
  "Carousel cover", "Carousel slide 2", "Carousel slide 3", "Story teaser",
  "Story poll", "Behind-the-scenes", "Lip-sync clip", "Color-grade variant",
  "Quote graphic", "Meme remix", "Talking-head cut", "Captioned hook",
  "Vertical poster", "Square poster", "Pinterest pin", "Thread cover",
  "Email header", "Newsletter GIF", "Threads quote", "B-roll loop",
  "Slow-mo cut", "Zoom-punch edit", "Text-overlay v1", "Text-overlay v2",
  "Endcard CTA", "Cover frame",
];

export const spinThirty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ prompt: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job, error } = await supabase
      .from("spin_jobs")
      .insert({ user_id: userId, prompt: data.prompt, total: SPIN_PIECES.length, status: "running" })
      .select("id")
      .single();
    if (error || !job) throw new Error(error?.message ?? "Failed to create spin job");

    const rows = SPIN_PIECES.map((label, idx) => ({
      job_id: job.id, user_id: userId, idx, label, status: "queued" as const,
    }));
    const { error: vErr } = await supabase.from("spin_variants").insert(rows);
    if (vErr) throw new Error(vErr.message);
    return { jobId: job.id as string };
  });

export const getSpinJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: job }, { data: variants }] = await Promise.all([
      supabase.from("spin_jobs").select("*").eq("id", data.jobId).single(),
      supabase.from("spin_variants").select("*").eq("job_id", data.jobId).order("idx", { ascending: true }),
    ]);
    if (!job) throw new Error("Job not found");
    return { job, variants: variants ?? [] };
  });

// Process the next batch of queued variants for a job.
// Picks up to N queued rows, marks them running, then simulates render
// completion with a deterministic preview URL keyed by label.
// Client calls this on a tight interval until the job is complete.
export const tickSpinJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid(), batch: z.number().min(1).max(6).default(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: pending } = await supabase
      .from("spin_variants")
      .select("id,idx,label")
      .eq("job_id", data.jobId)
      .eq("user_id", userId)
      .eq("status", "queued")
      .order("idx", { ascending: true })
      .limit(data.batch);

    if (!pending || pending.length === 0) {
      // No more queued — mark job done if all variants done
      const { count: remaining } = await supabase
        .from("spin_variants")
        .select("id", { count: "exact", head: true })
        .eq("job_id", data.jobId)
        .in("status", ["queued", "running"]);
      if ((remaining ?? 0) === 0) {
        await supabase.from("spin_jobs").update({ status: "done" }).eq("id", data.jobId);
      }
      return { processed: 0, done: (remaining ?? 0) === 0 };
    }

    // Mark running
    await supabase
      .from("spin_variants")
      .update({ status: "running" })
      .in("id", pending.map((p) => p.id));

    // "Render" — deterministic placeholder preview per label.
    // Picsum is seeded so each label gets a stable, distinct preview tile.
    const updates = pending.map((p) => {
      const seed = encodeURIComponent(`${data.jobId.slice(0, 8)}-${p.idx}`);
      const url = `https://picsum.photos/seed/${seed}/512/768`;
      return supabase
        .from("spin_variants")
        .update({ status: "done", url })
        .eq("id", p.id);
    });
    await Promise.all(updates);

    return { processed: pending.length, done: false };
  });