// Promotion sync orchestrator — shared by the server functions (link now,
// manual refresh) and the daily cron route. One path, so a cron sync and a
// user-triggered sync can never diverge.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { LinkPlatform, PlatformResult, PromotionMetrics, PromotionPlatform } from "./types";
import { syncSpotify } from "./spotify.server";
import { syncAppleMusic } from "./apple.server";
import { syncYoutube } from "./youtube.server";
import { syncAudiomack } from "./audiomack.server";
import { syncBoomplay } from "./boomplay.server";
import { syncTiktokStats } from "./tiktok-stats.server";
import {
  parseAppleMusicInput,
  parseAudiomackInput,
  parseBoomplayInput,
  parseSpotifyInput,
  parseYoutubeInput,
} from "./parsers";
import {
  SWEEP_PAGE_SIZE,
  SWEEP_TIME_BUDGET_MS,
  finishRetryPass,
  freshCheckpoint,
  nextSweepAction,
  recordOutcome,
  sweepComplete,
  type SweepCheckpoint,
  type SweepRetryRef,
} from "./sweep";

/** Which server secret(s) a platform needs before live stats work. */
export const PLATFORM_SECRET_HINTS: Record<PromotionPlatform, string | null> = {
  spotify: "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET",
  apple_music: null,
  audiomack: "AUDIOMACK_CONSUMER_KEY / AUDIOMACK_CONSUMER_SECRET",
  boomplay: null,
  youtube: "YOUTUBE_API_KEY",
  tiktok: "TikTok developer app: enable the Display API product (user.info.stats + video.list scopes)",
};

export function platformConfigured(platform: PromotionPlatform): boolean {
  switch (platform) {
    case "spotify":
      return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
    case "apple_music":
      return true;
    case "audiomack":
      return !!(process.env.AUDIOMACK_CONSUMER_KEY && process.env.AUDIOMACK_CONSUMER_SECRET);
    case "boomplay":
      return true;
    case "youtube":
      return !!process.env.YOUTUBE_API_KEY;
    case "tiktok":
      return !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
  }
}

function runAdapter(platform: LinkPlatform, input: string): Promise<PlatformResult> {
  switch (platform) {
    case "spotify":
      return syncSpotify(input);
    case "apple_music":
      return syncAppleMusic(input);
    case "youtube":
      return syncYoutube(input);
    case "audiomack":
      return syncAudiomack(input);
    case "boomplay":
      return syncBoomplay(input);
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

type Parsed = NonNullable<ReturnType<typeof parseSpotifyInput>>;

function parseFor(platform: LinkPlatform, input: string): Parsed | null {
  switch (platform) {
    case "spotify":
      return parseSpotifyInput(input);
    case "apple_music":
      return parseAppleMusicInput(input);
    case "youtube":
      return parseYoutubeInput(input);
    case "audiomack":
      return parseAudiomackInput(input);
    case "boomplay":
      return parseBoomplayInput(input);
  }
}

/** Canonical, host-pinned profile URL for a parsed identity (null for searches). */
function canonicalProfileUrl(platform: LinkPlatform, parsed: Parsed): string | null {
  switch (parsed.kind) {
    case "id":
      if (platform === "spotify") return `https://open.spotify.com/artist/${parsed.id}`;
      if (platform === "apple_music") return `https://music.apple.com/artist/${parsed.id}`;
      if (platform === "youtube") return `https://www.youtube.com/channel/${parsed.id}`;
      return null;
    case "handle":
      return platform === "youtube" ? `https://www.youtube.com/@${parsed.handle}` : null;
    case "slug":
      return platform === "audiomack" ? `https://audiomack.com/${parsed.slug}` : null;
    case "url":
      return platform === "boomplay" ? parsed.url : null;
    case "search":
      return null;
  }
}

async function writeSnapshot(
  userId: string,
  platform: PromotionPlatform,
  metrics: PromotionMetrics,
): Promise<void> {
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(metrics as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) clean[k] = v;
  }
  await supabaseAdmin
    .from("artist_platform_snapshots")
    .upsert(
      { user_id: userId, platform, day: todayUtc(), metrics: clean },
      { onConflict: "user_id,platform,day" },
    );
}

/**
 * Resolve a fresh link from pasted input, save the row, and record today's
 * snapshot. A "not_configured" adapter result still saves the link (profile
 * URL + dashboard button work without keys) — just without stats.
 */
export async function linkAndSync(
  userId: string,
  platform: LinkPlatform,
  input: string,
): Promise<PlatformResult & { linked?: boolean }> {
  const result = await runAdapter(platform, input);

  if (!result.ok && result.reason === "not_configured") {
    // Link-only save — still parse + canonicalize so a stored URL can never
    // point at a non-platform host, and surface save failures.
    const trimmed = input.trim();
    const parsed = parseFor(platform, trimmed);
    if (!parsed || (/^https?:\/\//i.test(trimmed) && parsed.kind === "search")) {
      return {
        ok: false,
        reason: "invalid_input",
        message: "That doesn't look like a valid profile for this platform.",
      };
    }
    const { error } = await supabaseAdmin.from("artist_platform_links").upsert(
      {
        user_id: userId,
        platform,
        external_id: null,
        profile_url: canonicalProfileUrl(platform, parsed) ?? "",
        display_name: parsed.kind === "search" ? parsed.query : null,
        image_url: null,
        detail: { items: [] } as unknown as Json,
        last_error: null,
      },
      { onConflict: "user_id,platform" },
    );
    if (error) {
      return { ok: false, reason: "provider_error", message: "Couldn't save the link. Try again." };
    }
    return { ...result, linked: true };
  }

  if (!result.ok) return result;

  const { data: d } = result;
  const { error } = await supabaseAdmin.from("artist_platform_links").upsert(
    {
      user_id: userId,
      platform,
      external_id: d.externalId,
      profile_url: d.profileUrl,
      display_name: d.displayName,
      image_url: d.imageUrl,
      detail: { items: d.items } as unknown as Json,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "user_id,platform" },
  );
  if (error) {
    return { ok: false, reason: "provider_error", message: "Couldn't save the link. Try again." };
  }
  await writeSnapshot(userId, platform, d.metrics);
  return { ...result, linked: true };
}

/** Re-sync an existing link row (manual refresh or daily cron). */
export async function syncExistingLink(
  userId: string,
  platform: LinkPlatform,
  profileInput: string,
): Promise<PlatformResult> {
  const result = await runAdapter(platform, profileInput);
  if (!result.ok) {
    if (result.reason !== "not_configured") {
      await supabaseAdmin
        .from("artist_platform_links")
        .update({ last_error: result.message.slice(0, 300) })
        .eq("user_id", userId)
        .eq("platform", platform);
    }
    return result;
  }
  const { data: d } = result;
  await supabaseAdmin
    .from("artist_platform_links")
    .update({
      external_id: d.externalId,
      profile_url: d.profileUrl,
      display_name: d.displayName,
      image_url: d.imageUrl,
      detail: { items: d.items } as unknown as Json,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("user_id", userId)
    .eq("platform", platform);
  await writeSnapshot(userId, platform, d.metrics);
  return result;
}

/** Sync a stats-capable TikTok account into the shared link + snapshot rows. */
export async function syncTiktokIntoHub(userId: string): Promise<PlatformResult> {
  const result = await syncTiktokStats(userId);
  if (!result.ok) {
    if (result.reason === "provider_error") {
      await supabaseAdmin
        .from("artist_platform_links")
        .update({ last_error: result.message.slice(0, 300) })
        .eq("user_id", userId)
        .eq("platform", "tiktok");
    }
    return result;
  }
  const { data: d } = result;
  await supabaseAdmin.from("artist_platform_links").upsert(
    {
      user_id: userId,
      platform: "tiktok",
      external_id: d.externalId,
      profile_url: d.profileUrl,
      display_name: d.displayName,
      image_url: d.imageUrl,
      detail: { items: d.items } as unknown as Json,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    },
    { onConflict: "user_id,platform" },
  );
  await writeSnapshot(userId, "tiktok", d.metrics);
  return result;
}

interface LinkPageRow {
  user_id: string;
  platform: PromotionPlatform;
  profile_url: string;
  display_name: string | null;
  sweep_seq: number;
}

interface SweepStateRow {
  day: string;
  link_cursor: number | string; // bigint may arrive as a string
  tiktok_cursor: string;
  links_done: boolean;
  tiktok_done: boolean;
  retried_today: boolean;
  retry: unknown;
  retry_overflow: number | string;
  synced: number;
  failed: number;
  skipped: number;
}

function rowToCheckpoint(r: SweepStateRow): SweepCheckpoint {
  return {
    day: r.day,
    linkCursor: Number(r.link_cursor) || 0,
    tiktokCursor: r.tiktok_cursor || freshCheckpoint(r.day).tiktokCursor,
    linksDone: !!r.links_done,
    tiktokDone: !!r.tiktok_done,
    retriedToday: !!r.retried_today,
    retry: Array.isArray(r.retry)
      ? (r.retry as SweepRetryRef[]).filter((x) => x && typeof x.user_id === "string")
      : [],
    retryOverflow: Number(r.retry_overflow) || 0,
    synced: Number(r.synced) || 0,
    failed: Number(r.failed) || 0,
    skipped: Number(r.skipped) || 0,
  };
}

function checkpointToRow(s: SweepCheckpoint) {
  return {
    day: s.day,
    link_cursor: s.linkCursor,
    tiktok_cursor: s.tiktokCursor,
    links_done: s.linksDone,
    tiktok_done: s.tiktokDone,
    retried_today: s.retriedToday,
    retry: s.retry as unknown as Json,
    retry_overflow: s.retryOverflow,
    synced: s.synced,
    failed: s.failed,
    skipped: s.skipped,
    updated_at: new Date().toISOString(),
  };
}

/** Lease TTL: one runner budget + margin; a crashed runner's day is reclaimable. */
const SWEEP_LEASE_TTL_MS = 4 * 60_000;

/**
 * Ensure the day's checkpoint row exists, claim the single-runner lease, and
 * return the freshest persisted state. Returns null when another live runner
 * holds the day. Every step is fail-closed: any Supabase error throws, so a
 * run can never report progress against state that was not durably saved.
 */
async function acquireCheckpoint(day: string, owner: string): Promise<SweepCheckpoint | null> {
  const { error: initError } = await supabaseAdmin
    .from("promotion_sweep_state")
    .upsert(checkpointToRow(freshCheckpoint(day)), { onConflict: "day", ignoreDuplicates: true });
  if (initError) throw new Error(`checkpoint init failed: ${initError.message}`);

  // Atomic claim: only an absent/expired lease can be taken.
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("promotion_sweep_state")
    .update({
      lease_owner: owner,
      lease_expires: new Date(Date.now() + SWEEP_LEASE_TTL_MS).toISOString(),
    })
    .eq("day", day)
    .or(`lease_expires.is.null,lease_expires.lt.${now}`)
    .select("day")
    .maybeSingle();
  if (claimError) throw new Error(`checkpoint lease failed: ${claimError.message}`);
  if (!claimed) return null;

  const { data, error } = await supabaseAdmin
    .from("promotion_sweep_state")
    .select("*")
    .eq("day", day)
    .maybeSingle();
  if (error) throw new Error(`checkpoint read failed: ${error.message}`);
  return data ? rowToCheckpoint(data as unknown as SweepStateRow) : freshCheckpoint(day);
}

/**
 * Lease-scoped checkpoint write. If the lease was lost (overrun or takeover)
 * zero rows update and we throw instead of regressing another runner's state.
 */
async function saveCheckpoint(s: SweepCheckpoint, owner: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("promotion_sweep_state")
    .update(checkpointToRow(s))
    .eq("day", s.day)
    .eq("lease_owner", owner)
    .select("day");
  if (error) throw new Error(`checkpoint save failed: ${error.message}`);
  if (!data || data.length === 0) throw new Error("checkpoint lease lost mid-run");
}

/** Best-effort release; an unreleased lease simply expires after the TTL. */
async function releaseLease(day: string, owner: string): Promise<void> {
  await supabaseAdmin
    .from("promotion_sweep_state")
    .update({ lease_owner: null, lease_expires: null })
    .eq("day", day)
    .eq("lease_owner", owner);
}

async function visitLinkRow(r: LinkPageRow): Promise<"synced" | "failed" | "skipped"> {
  try {
    if (r.platform === "tiktok") {
      const res = await syncTiktokIntoHub(r.user_id);
      // "reconnect_required" / not connected = a state, not a sync failure.
      if (res.ok) return "synced";
      if (res.reason === "invalid_input" || res.reason === "not_found") return "skipped";
      return "failed";
    }
    const input = r.profile_url || r.display_name || "";
    if (!input) return "skipped";
    const res = await syncExistingLink(r.user_id, r.platform as LinkPlatform, input);
    if (res.ok) return "synced";
    if (res.reason === "not_configured") return "skipped";
    return "failed";
  } catch (e) {
    console.warn(
      `[promotion-sync] ${r.platform} for ${r.user_id} failed:`,
      e instanceof Error ? e.message : e,
    );
    return "failed";
  }
}

async function visitTiktokUser(userId: string): Promise<"synced" | "failed" | "skipped"> {
  try {
    const res = await syncTiktokIntoHub(userId);
    if (res.ok) return "synced";
    if (
      res.reason === "not_found" ||
      res.reason === "invalid_input" ||
      res.reason === "not_configured"
    )
      return "skipped";
    return "failed";
  } catch (e) {
    console.warn(
      `[promotion-sync] tiktok for ${userId} failed:`,
      e instanceof Error ? e.message : e,
    );
    return "failed";
  }
}

async function visitLinkRef(ref: SweepRetryRef): Promise<"synced" | "failed" | "skipped"> {
  const { data } = await supabaseAdmin
    .from("artist_platform_links")
    .select("user_id, platform, profile_url, display_name, sweep_seq")
    .eq("user_id", ref.user_id)
    .eq("platform", ref.platform)
    .maybeSingle();
  if (!data) return "skipped"; // unlinked since the failure was queued
  return visitLinkRow(data as unknown as LinkPageRow);
}

export interface DailySweepResult {
  /** True only when every row was visited AND the retry pass settled. */
  done: boolean;
  /** True when another live runner holds today's lease. */
  busy: boolean;
  synced: number;
  failed: number;
  skipped: number;
  /** Failures that outgrew the retry list — retried by tomorrow's sweep. */
  retryOverflow: number;
}

/**
 * Daily cron sweep — resumable. Each invocation resumes from the persisted
 * per-UTC-day checkpoint (keyset cursors, never offset-from-zero), works
 * within a time budget under the daemon's curl cap, and reports done only
 * when every link row and TikTok account was visited and the retry pass
 * settled. Snapshot upserts are day-unique, so a row visited twice (e.g. by
 * overlapping invocations) is still exactly once per daily snapshot.
 */
export async function syncAllPromotionPlatforms(
  budgetMs = SWEEP_TIME_BUDGET_MS,
): Promise<DailySweepResult> {
  const day = todayUtc();
  const owner = crypto.randomUUID();
  const state = await acquireCheckpoint(day, owner);
  if (!state) {
    return { done: false, busy: true, synced: 0, failed: 0, skipped: 0, retryOverflow: 0 };
  }
  const startedAt = Date.now();
  const withinBudget = () => Date.now() - startedAt < budgetMs;
  // On a thrown error the lease is NOT released — it expires after the TTL
  // and the next tick reclaims the day from the last durably saved page.

  while (withinBudget()) {
    const action = nextSweepAction(state);
    if (action === "done") break;

    if (action === "links") {
      const { data, error } = await supabaseAdmin
        .from("artist_platform_links")
        .select("user_id, platform, profile_url, display_name, sweep_seq")
        .gt("sweep_seq", state.linkCursor)
        .order("sweep_seq", { ascending: true })
        .limit(SWEEP_PAGE_SIZE);
      if (error) throw new Error(`links page fetch failed: ${error.message}`);
      const rows = (data ?? []) as unknown as LinkPageRow[];
      if (rows.length === 0) {
        state.linksDone = true;
        await saveCheckpoint(state, owner);
        continue;
      }
      for (const r of rows) {
        const outcome = await visitLinkRow(r);
        recordOutcome(state, outcome, { user_id: r.user_id, platform: r.platform });
        state.linkCursor = r.sweep_seq;
      }
      if (rows.length < SWEEP_PAGE_SIZE) state.linksDone = true;
      await saveCheckpoint(state, owner);
      continue;
    }

    if (action === "tiktok") {
      const { data, error } = await supabaseAdmin
        .from("tiktok_accounts")
        .select("user_id")
        .neq("open_id", "pending")
        .gt("user_id", state.tiktokCursor)
        .order("user_id", { ascending: true })
        .limit(SWEEP_PAGE_SIZE);
      if (error) throw new Error(`tiktok page fetch failed: ${error.message}`);
      const rows = (data ?? []) as unknown as { user_id: string }[];
      if (rows.length === 0) {
        state.tiktokDone = true;
        await saveCheckpoint(state, owner);
        continue;
      }
      // Accounts with a cached link row were already synced in the links
      // phase (which always runs first) — skip them here. Durable check, not
      // an in-memory set, so it survives across invocations.
      const { data: linked } = await supabaseAdmin
        .from("artist_platform_links")
        .select("user_id")
        .eq("platform", "tiktok")
        .in("user_id", rows.map((r) => r.user_id));
      const already = new Set(((linked ?? []) as unknown as { user_id: string }[]).map((r) => r.user_id));
      for (const r of rows) {
        if (!already.has(r.user_id)) {
          const outcome = await visitTiktokUser(r.user_id);
          recordOutcome(state, outcome, { user_id: r.user_id, platform: "tiktok" });
        }
        state.tiktokCursor = r.user_id;
      }
      if (rows.length < SWEEP_PAGE_SIZE) state.tiktokDone = true;
      await saveCheckpoint(state, owner);
      continue;
    }

    // retry pass — at most one per day; second failures are terminal today
    const pending = state.retry;
    state.retry = [];
    let finished = true;
    for (let i = 0; i < pending.length; i++) {
      if (!withinBudget()) {
        state.retry = pending.slice(i); // leftovers resume next invocation
        finished = false;
        break;
      }
      const ref = pending[i];
      const outcome =
        ref.platform === "tiktok" ? await visitTiktokUser(ref.user_id) : await visitLinkRef(ref);
      recordOutcome(state, outcome); // no ref — never re-queued
    }
    if (finished) finishRetryPass(state);
    await saveCheckpoint(state, owner);
  }

  await saveCheckpoint(state, owner);
  await releaseLease(day, owner);
  return {
    done: sweepComplete(state),
    busy: false,
    synced: state.synced,
    failed: state.failed,
    skipped: state.skipped,
    retryOverflow: state.retryOverflow,
  };
}
