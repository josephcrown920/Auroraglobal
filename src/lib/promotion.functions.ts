// Promotion Hub — client-callable server functions.
// (Client-called createServerFn must live in *.functions.ts, never *.server.ts.)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdmin } from "@/lib/admin.server";
import {
  LINK_PLATFORMS,
  PLATFORM_META,
  PROMOTION_PLATFORMS,
  PROMOTION_SYNC_COOLDOWN_MS,
  syncCooldownRemainingMs,
  type LinkPlatform,
  type PromotionDetailItem,
  type PromotionMetrics,
  type PromotionPlatform,
} from "@/lib/promotion/types";
import {
  PLATFORM_SECRET_HINTS,
  linkAndSync,
  platformConfigured,
  syncAllPromotionPlatforms,
  syncExistingLink,
  syncTiktokIntoHub,
} from "@/lib/promotion/sync.server";
import { tiktokHasStatsScopes } from "@/lib/promotion/tiktok-stats.server";

const linkSchema = z.object({
  platform: z.enum(LINK_PLATFORMS),
  input: z.string().trim().min(2).max(400),
});

const platformSchema = z.object({
  platform: z.enum(PROMOTION_PLATFORMS),
});

const growthSchema = z.object({
  platform: z.enum(PROMOTION_PLATFORMS),
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
});

export interface PromotionCard {
  platform: PromotionPlatform;
  linked: boolean;
  externalId: string | null;
  profileUrl: string | null;
  displayName: string | null;
  imageUrl: string | null;
  items: PromotionDetailItem[];
  metrics: PromotionMetrics;
  today: PromotionMetrics | null;
  yesterday: PromotionMetrics | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  cooldownUntil: number | null;
  configured: boolean;
  /** Only set for admins — which secret/scope the owner still needs to add. */
  missingHint?: string | null;
  /** TikTok-only state. */
  tiktok?: {
    connected: boolean;
    hasStatsScopes: boolean;
    sessionExpired: boolean;
  };
  /** Last ~7 days of the platform's growth metric, ascending (card sparkline). */
  spark: { day: string; value: number }[];
}

function metricsOf(row: unknown): PromotionMetrics {
  const m = (row as { metrics?: unknown } | null)?.metrics;
  return m && typeof m === "object" ? (m as PromotionMetrics) : {};
}

export const getMyPromotionDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ cards: PromotionCard[] }> => {
    const { userId } = context;

    const sparkSince = new Date(Date.now() - 8 * 86_400_000).toISOString().slice(0, 10);
    const [{ data: links }, { data: snaps }, { data: tiktokAcc }, admin] = await Promise.all([
      supabaseAdmin
        .from("artist_platform_links")
        .select("platform, external_id, profile_url, display_name, image_url, detail, last_synced_at, last_error")
        .eq("user_id", userId),
      supabaseAdmin
        .from("artist_platform_snapshots")
        .select("platform, day, metrics")
        .eq("user_id", userId)
        .gte("day", sparkSince)
        .order("day", { ascending: false })
        .limit(60),
      supabaseAdmin
        .from("tiktok_accounts")
        .select("scope, refresh_expires_at")
        .eq("user_id", userId)
        .neq("open_id", "pending")
        .maybeSingle(),
      isAdmin(userId),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const byPlatform = new Map((links ?? []).map((l) => [(l as { platform: string }).platform, l]));
    const snapBy = new Map<string, { today: PromotionMetrics | null; yesterday: PromotionMetrics | null }>();
    for (const s of snaps ?? []) {
      const row = s as unknown as { platform: string; day: string; metrics: PromotionMetrics };
      const entry = snapBy.get(row.platform) ?? { today: null, yesterday: null };
      if (row.day === today && !entry.today) entry.today = metricsOf(row);
      else if (row.day === yesterday && !entry.yesterday) entry.yesterday = metricsOf(row);
      snapBy.set(row.platform, entry);
    }

    const tt = tiktokAcc as unknown as { scope: string | null; refresh_expires_at: string } | null;
    const tiktokState = {
      connected: !!tt,
      hasStatsScopes: tiktokHasStatsScopes(tt?.scope),
      sessionExpired: tt ? new Date(tt.refresh_expires_at).getTime() < Date.now() : false,
    };

    // Card sparklines: last ~7 days of each platform's growth metric, ascending.
    const sparkBy = new Map<string, { day: string; value: number }[]>();
    for (const s of snaps ?? []) {
      const row = s as unknown as { platform: string; day: string; metrics: PromotionMetrics };
      const metricKey = PLATFORM_META[row.platform as PromotionPlatform]?.growthMetric;
      if (!metricKey) continue;
      const value = row.metrics?.[metricKey];
      if (typeof value !== "number") continue;
      const arr = sparkBy.get(row.platform) ?? [];
      arr.push({ day: row.day, value });
      sparkBy.set(row.platform, arr);
    }
    for (const arr of sparkBy.values()) {
      arr.sort((a, b) => a.day.localeCompare(b.day));
    }

    const cards: PromotionCard[] = PROMOTION_PLATFORMS.map((platform) => {
      const link = byPlatform.get(platform) as
        | {
            external_id: string | null;
            profile_url: string;
            display_name: string | null;
            image_url: string | null;
            detail: { items?: PromotionDetailItem[] } | null;
            last_synced_at: string | null;
            last_error: string | null;
          }
        | undefined;
      const configured = platformConfigured(platform);
      const snap = snapBy.get(platform) ?? { today: null, yesterday: null };
      const card: PromotionCard = {
        platform,
        linked: platform === "tiktok" ? tiktokState.connected : !!link,
        externalId: link?.external_id ?? null,
        profileUrl: link?.profile_url || null,
        displayName: link?.display_name ?? null,
        imageUrl: link?.image_url ?? null,
        items: link?.detail?.items ?? [],
        metrics: snap.today ?? {},
        today: snap.today,
        yesterday: snap.yesterday,
        lastSyncedAt: link?.last_synced_at ?? null,
        lastError: link?.last_error ?? null,
        cooldownUntil: link?.last_synced_at
          ? Date.now() + syncCooldownRemainingMs(link.last_synced_at)
          : null,
        configured,
        missingHint: admin && !configured ? PLATFORM_SECRET_HINTS[platform] : null,
        spark: sparkBy.get(platform) ?? [],
      };
      if (platform === "tiktok") card.tiktok = tiktokState;
      return card;
    });
    return { cards };
  });

export const linkPromotionPlatform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => linkSchema.parse(data))
  .handler(async ({ context, data }) => {
    const result = await linkAndSync(context.userId, data.platform as LinkPlatform, data.input);
    if (!result.ok && !result.linked) {
      throw new Error(result.message);
    }
    return {
      ok: true,
      statsReady: result.ok,
      notConfigured: !result.ok && result.reason === "not_configured",
    };
  });

export const unlinkPromotionPlatform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => platformSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    await Promise.all([
      supabaseAdmin
        .from("artist_platform_links")
        .delete()
        .eq("user_id", userId)
        .eq("platform", data.platform),
      supabaseAdmin
        .from("artist_platform_snapshots")
        .delete()
        .eq("user_id", userId)
        .eq("platform", data.platform),
      ...(data.platform === "tiktok"
        ? [supabaseAdmin.from("tiktok_accounts").delete().eq("user_id", userId)]
        : []),
    ]);
    return { ok: true };
  });

export const syncPromotionPlatform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => platformSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { platform } = data;

    const cutoff = new Date(Date.now() - PROMOTION_SYNC_COOLDOWN_MS).toISOString();
    // Atomic cooldown claim: stamp last_synced_at only when the row is outside
    // the cooldown window, so two concurrent refreshes can't both pass.
    const { data: claimed } = await supabaseAdmin
      .from("artist_platform_links")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("platform", platform)
      .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
      .select("profile_url, display_name")
      .maybeSingle();
    const row = claimed as unknown as {
      profile_url: string;
      display_name: string | null;
    } | null;

    if (!row) {
      const { data: existing } = await supabaseAdmin
        .from("artist_platform_links")
        .select("last_synced_at")
        .eq("user_id", userId)
        .eq("platform", platform)
        .maybeSingle();
      if (!existing) {
        // TikTok can sync without a cached link row (OAuth identity source).
        if (platform !== "tiktok") throw new Error("Link the platform first.");
      } else {
        const remaining = syncCooldownRemainingMs(
          (existing as { last_synced_at: string | null }).last_synced_at,
        );
        throw new Error(
          `Just refreshed — try again in ${Math.max(1, Math.ceil(remaining / 60_000))} min.`,
        );
      }
    }

    const result =
      platform === "tiktok"
        ? await syncTiktokIntoHub(userId)
        : await syncExistingLink(
            userId,
            platform as LinkPlatform,
            row!.profile_url || row!.display_name || "",
          );

    if (!result.ok) {
      if (result.reason === "not_configured") {
        throw new Error("Stats for this platform aren't turned on yet — the dashboard button still works.");
      }
      if (result.message === "reconnect_required") {
        throw new Error("Reconnect TikTok to turn on stats.");
      }
      throw new Error("Couldn't refresh right now. The platform may be busy — try again later.");
    }
    return { ok: true };
  });

export const getPromotionGrowth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => growthSchema.parse(data))
  .handler(async ({ context, data }) => {
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString().slice(0, 10);
    const { data: rows } = await supabaseAdmin
      .from("artist_platform_snapshots")
      .select("day, metrics")
      .eq("user_id", context.userId)
      .eq("platform", data.platform)
      .gte("day", since)
      .order("day", { ascending: true });
    return {
      points: (rows ?? []).map((r) => {
        const row = r as unknown as { day: string; metrics: PromotionMetrics };
        return { day: row.day, metrics: row.metrics };
      }),
    };
  });

/** Admin-only manual trigger of the full sweep (the cron route is the daily driver). */
export const syncAllMyPromotionPlatforms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Unauthorized");
    return syncAllPromotionPlatforms(50);
  });
