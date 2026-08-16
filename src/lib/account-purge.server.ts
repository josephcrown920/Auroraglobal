// Shared account-data purge helpers.
//
// Used by BOTH:
//   - /api/public/account-delete  (steps 1/2 pre-checks + post-auth final sweep)
//   - /api/public/deletion-sweep  (cron-driven durable retry of failed sweeps)
//
// Both functions THROW on any error — callers decide whether that means
// "500, account intact, user retries" (pre-auth-deletion) or "queue a durable
// retry row" (post-auth-deletion).
//
// Server-only (*.server.ts is stubbed from the client bundle); route files
// must import this dynamically inside handlers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Every user-owned table deleted by user_id, children before parents.
// Derived from the generated Supabase types (all Tables with a user_id
// column) minus the two retained tables (payments, legal_acceptances) —
// keep in sync when adding tables.
export const USER_TABLES_IN_DELETE_ORDER = [
  // Children of batches/jobs/boards/templates first…
  "cm_batch_items",
  "cm_batches",
  "spin_variants",
  "comfy_runs",
  "kids_stories",
  "video_agent_messages",
  "video_agent_submissions",
  "video_agent_projects",
  "board_items",
  "chat_threads",
  "promo_code_redemptions",
  "tiktok_remixes",
  "tiktok_posts",
  "tiktok_accounts",
  "generations",
  "agent_chat_messages",
  "agent_sessions",
  // …then their parents…
  "cm_products",
  "cm_templates",
  "spin_jobs",
  "boards",
  "jobs",
  // …then everything independent.
  "worker_jobs",
  "lipsync_jobs",
  "ad_variations",
  "affiliate_events",
  "affiliates",
  "agent_user_memory",
  "api_keys",
  "aurora_templates",
  "user_avatar_shots",
  "avatars",
  "character_profiles",
  "cli_device_codes",
  "consent_logs",
  "contact_messages",
  "edit_sessions",
  "email_log",
  "events",
  "growth_tool_runs",
  "likeness_locks",
  "provider_logs",
  "storyboards",
  "subscriptions",
  "user_passkeys",
  "user_photo_avatars",
  "user_roles",
  "user_webhooks",
  "wardrobe_items",
  "webauthn_challenges",
  "workflows",
  "credit_ledger",
  "profiles",
] as const;

// Recursive, paginated purge of every user-owned `studio` namespace:
//   <uid>/...            uploads, spin/<job>/, video-agent/<proj>/, audio/,
//                        avatars/, mastering/, hf-video/, gemini/, tts/,
//                        replit-tts/ — every uid-prefixed folder is covered
//                        by the recursive walk, present and future.
//   tts/<uid>/...        legacy HF text-to-speech artifacts
//   ffmpeg-free/<uid>/.. local ffmpeg assembles
// Plus explicit user_photo_avatars.storage_path rows (re-read per invocation;
// they may already be gone on a sweep re-run, which is fine).
// THROWS on any list/remove error or traversal-cap hit — proceeding on a
// partial listing would orphan unlisted bytes while claiming "deleted".
export async function purgeUserStorage(userId: string): Promise<void> {
  const bucket = supabaseAdmin.storage.from("studio");

  const { data: avatarRows, error: avatarPathErr } = await supabaseAdmin
    .from("user_photo_avatars")
    .select("storage_path")
    .eq("user_id", userId);
  if (avatarPathErr) throw new Error(`avatar path read failed: ${avatarPathErr.message}`);
  const explicit = (avatarRows ?? []).map((r) => r.storage_path).filter(Boolean);

  const files: string[] = [];
  const queue = [userId, `tts/${userId}`, `ffmpeg-free/${userId}`];
  const LIMIT = 1000;
  const MAX_FILES = 20000;
  const MAX_DIRS = 2000;
  let dirs = 0;
  while (queue.length > 0) {
    if (files.length >= MAX_FILES || dirs >= MAX_DIRS) {
      throw new Error(`purge caps hit (${files.length} files, ${dirs} dirs)`);
    }
    const prefix = queue.shift() as string;
    dirs++;
    for (let offset = 0; ; offset += LIMIT) {
      const { data: entries, error } = await bucket.list(prefix, { limit: LIMIT, offset });
      if (error) throw new Error(`list ${prefix} failed: ${error.message}`);
      for (const entry of entries ?? []) {
        // Folders come back with id === null; files have an id.
        if (entry.id === null) queue.push(`${prefix}/${entry.name}`);
        else files.push(`${prefix}/${entry.name}`);
      }
      if (!entries || entries.length < LIMIT) break;
    }
  }
  const all = [...new Set([...explicit, ...files])];
  for (let i = 0; i < all.length; i += 100) {
    const { error } = await bucket.remove(all.slice(i, i + 100));
    if (error) throw new Error(`remove failed: ${error.message}`);
  }
}

// Explicit row deletes from EVERY user-owned table, children before parents
// (schema FKs are all CASCADE / SET NULL, never RESTRICT — the ordering is
// belt-and-braces, not load-bearing). Includes tables keyed by other columns:
// render_jobs (via the user's board ids), marketplace_template_runs
// (runner_user_id), marketplace_templates (creator_user_id — cascades other
// users' runs of those templates), comfy_workflows (owner_user_id).
// Board ids are re-read on each invocation. THROWS on any error.
export async function purgeUserRows(userId: string): Promise<void> {
  const { data: boardRows, error: boardErr } = await supabaseAdmin
    .from("boards")
    .select("id")
    .eq("user_id", userId);
  if (boardErr) throw new Error(`boards read failed: ${boardErr.message}`);
  const boardIds = (boardRows ?? []).map((b) => b.id);
  for (let i = 0; i < boardIds.length; i += 200) {
    const { error } = await supabaseAdmin
      .from("render_jobs")
      .delete()
      .in("board_id", boardIds.slice(i, i + 200));
    if (error) throw new Error(`render_jobs delete failed: ${error.message}`);
  }
  {
    const { error } = await supabaseAdmin
      .from("marketplace_template_runs")
      .delete()
      .eq("runner_user_id", userId);
    if (error) throw new Error(`marketplace_template_runs delete failed: ${error.message}`);
  }
  {
    // Cascades other users' runs of this user's templates (FK CASCADE).
    const { error } = await supabaseAdmin
      .from("marketplace_templates")
      .delete()
      .eq("creator_user_id", userId);
    if (error) throw new Error(`marketplace_templates delete failed: ${error.message}`);
  }
  {
    const { error } = await supabaseAdmin
      .from("comfy_workflows")
      .delete()
      .eq("owner_user_id", userId);
    if (error) throw new Error(`comfy_workflows delete failed: ${error.message}`);
  }

  for (const table of USER_TABLES_IN_DELETE_ORDER) {
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`${table} delete failed: ${error.message}`);
  }
}
