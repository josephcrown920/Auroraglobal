import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth, isAdmin } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// 1 Aura per spin piece — matches COST_IMAGE in studio.functions.ts.
// Charged upfront for all SPIN_PIECES.length pieces before the job is created.
const COST_SPIN_PIECE = 1;

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

    // Charge credits upfront for every piece in the batch. Atomic deduct_credits
    // prevents a double-spend even under parallel requests (single SQL UPDATE with
    // WHERE credits >= _amount RETURNING). Mirrored from chargeCredits in
    // studio.functions.ts. Charged before job creation so a failed charge never
    // leaves a dangling job row consuming quota silently.
    // Admins bypass the charge entirely — consistent with all other charge points.
    const spinCost = SPIN_PIECES.length * COST_SPIN_PIECE;
    const creditRef = crypto.randomUUID();
    const adminUser = await isAdmin(userId);
    if (!adminUser) {
      const { data: charged, error: creditErr } = await supabaseAdmin.rpc("deduct_credits", {
        _user: userId,
        _amount: spinCost,
        _reason: "spin_batch",
        _ref: creditRef,
      });
      if (creditErr) throw new Error(creditErr.message);
      if (charged === false) throw new Error("Not enough Aura. Buy more from the Aura panel.");
    }

    const { data: job, error } = await supabase
      .from("spin_jobs")
      .insert({ user_id: userId, prompt: data.prompt, total: SPIN_PIECES.length, status: "running" })
      .select("id")
      .single();
    if (error || !job) {
      // Refund: job creation failed after charging — give credits back (admins were never charged).
      if (!adminUser) {
        await supabaseAdmin.rpc("grant_credits", {
          _user: userId,
          _amount: spinCost,
          _reason: "refund_failed_generation",
          _ref: creditRef,
        });
      }
      throw new Error(error?.message ?? "Failed to create spin job");
    }

    const rows = SPIN_PIECES.map((label, idx) => ({
      job_id: job.id, user_id: userId, idx, label, status: "queued" as const,
    }));
    const { error: vErr } = await supabase.from("spin_variants").insert(rows);
    if (vErr) {
      // Refund: variant insertion failed after charging — give credits back (admins were never charged).
      if (!adminUser) {
        await supabaseAdmin.rpc("grant_credits", {
          _user: userId,
          _amount: spinCost,
          _reason: "refund_failed_generation",
          _ref: creditRef,
        });
      }
      throw new Error(vErr.message);
    }
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