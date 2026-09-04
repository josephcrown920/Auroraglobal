// Promotion Hub — one page for an artist's Spotify, Apple Music, Audiomack,
// Boomplay, YouTube and TikTok numbers. Visual-first: media above copy on
// every card, real artwork from platform data, count-up numbers, sparklines.
import { createLazyFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  Eye,
  Heart,
  Link2,
  Loader2,
  MessageCircle,
  Play,
  RefreshCw,
  Search,
  Share2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { authNextSearch } from "@/lib/auth-return-path";
import { initTiktokConnect } from "@/lib/tiktok-posting.functions";
import {
  getMyPromotionDashboard,
  getPromotionGrowth,
  linkPromotionPlatform,
  syncPromotionPlatform,
  unlinkPromotionPlatform,
  type PromotionCard,
} from "@/lib/promotion.functions";
import {
  LINK_PLATFORMS,
  PLATFORM_META,
  PROMOTION_PLATFORMS,
  formatCompactCount,
  platformDashboardUrl,
  type LinkPlatform,
  type PromotionMetrics,
  type PromotionPlatform,
} from "@/lib/promotion/types";
import { PlatformMark } from "@/components/promotion/PlatformMark";
import { useCountUp } from "@/components/promotion/useCountUp";
import { SiteFooter } from "@/components/SiteFooter";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/promotion")({
  component: PromotionPage,
});

/* ── small pieces ─────────────────────────────────────────────────────────── */

function Sparkline({ points, color }: { points: { day: string; value: number }[]; color: string }) {
  if (points.length < 2) {
    return (
      <div className="flex h-10 items-center gap-1 px-1">
        {[3, 5, 4, 6, 5, 7, 6].map((h, i) => (
          <span
            key={i}
            className="w-1.5 rounded-full opacity-30"
            style={{ height: `${h * 4}px`, background: color }}
          />
        ))}
      </div>
    );
  }
  const w = 120;
  const h = 40;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * (w - 4) + 2;
      const y = h - 4 - ((p.value - min) / range) * (h - 8);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        pathLength={1}
        className="motion-safe:animate-[promotion-spark_1.2s_ease-out]"
        strokeDasharray={1}
      />
    </svg>
  );
}

function HeadlineNumber({ value }: { value: number | null | undefined }) {
  const v = useCountUp(value ?? 0);
  return <>{formatCompactCount(value == null ? null : v)}</>;
}

function DeltaChip({ today, yesterday, metricKey }: {
  today: PromotionMetrics | null;
  yesterday: PromotionMetrics | null;
  metricKey: keyof PromotionMetrics | null;
}) {
  if (!metricKey || !today || !yesterday) return null;
  const t = today[metricKey];
  const y = yesterday[metricKey];
  if (typeof t !== "number" || typeof y !== "number") return null;
  const diff = t - y;
  if (diff === 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        diff > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400",
      )}
    >
      <TrendingUp className={cn("size-3", diff < 0 && "rotate-180")} />
      {diff > 0 ? "+" : ""}{formatCompactCount(diff)} today
    </span>
  );
}

/* ── connect form ─────────────────────────────────────────────────────────── */

function ConnectForm({ card, onLinked }: { card: PromotionCard; onLinked: () => void }) {
  const [input, setInput] = useState("");
  const linkFn = useServerFn(linkPromotionPlatform);
  const mut = useMutation({
    mutationFn: (value: string) =>
      linkFn({ data: { platform: card.platform as LinkPlatform, input: value } }),
    onSuccess: (r) => {
      if (r.notConfigured) {
        toast.success(`${PLATFORM_META[card.platform].label} linked — stats turn on as soon as the platform API is enabled.`);
      } else {
        toast.success(`${PLATFORM_META[card.platform].label} linked!`);
      }
      setInput("");
      onLinked();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't link that."),
  });

  const meta = PLATFORM_META[card.platform];
  const urlOnly = card.platform === "boomplay";
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (input.trim().length >= 2 && !mut.isPending) mut.mutate(input);
      }}
    >
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 focus-within:border-primary/50">
        {urlOnly ? (
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <Search className="size-4 shrink-0 text-muted-foreground" />
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={urlOnly ? meta.placeholderUrl : `Artist name or ${meta.placeholderUrl}`}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          aria-label={`Link your ${meta.label} profile`}
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={input.trim().length < 2 || mut.isPending}
        className="w-full rounded-xl font-semibold"
        style={{ background: meta.color, color: "#0b0b0f" }}
      >
        {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
        Link {meta.label}
      </Button>
    </form>
  );
}

function TiktokConnectButton({ card, onConnected }: { card: PromotionCard; onConnected: () => void }) {
  const initFn = useServerFn(initTiktokConnect);
  const [busy, setBusy] = useState(false);
  const reconnect = card.tiktok?.connected && !card.tiktok.hasStatsScopes;
  return (
    <Button
      type="button"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await initFn({ data: { returnTo: "/promotion" } });
          window.location.href = r.authUrl;
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "TikTok connect failed");
          setBusy(false);
        }
      }}
      className="w-full rounded-xl font-semibold text-white"
      style={{ background: "linear-gradient(90deg, #25F4EE, #FE2C55)" }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <PlatformMark platform="tiktok" className="size-4" />}
      {reconnect ? "Reconnect TikTok to turn on stats" : "Connect TikTok"}
    </Button>
  );
}

/* ── platform card ────────────────────────────────────────────────────────── */

function StatBlock({ label, value, icon }: { label: string; value: number | null | undefined; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-background/50 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold tabular-nums text-foreground">
        <HeadlineNumber value={value} />
      </div>
    </div>
  );
}

function PlatformCard({ card, index, onChanged }: { card: PromotionCard; index: number; onChanged: () => void }) {
  const meta = PLATFORM_META[card.platform];
  const syncFn = useServerFn(syncPromotionPlatform);
  const unlinkFn = useServerFn(unlinkPromotionPlatform);
  const syncMut = useMutation({
    mutationFn: () => syncFn({ data: { platform: card.platform } }),
    onSuccess: () => {
      toast.success(`${meta.label} refreshed`);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Refresh failed"),
  });
  const unlinkMut = useMutation({
    mutationFn: () => unlinkFn({ data: { platform: card.platform } }),
    onSuccess: () => {
      toast(`${meta.label} unlinked`);
      onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unlink failed"),
  });

  const needsReconnect = card.platform === "tiktok" && card.tiktok?.connected && !card.tiktok.hasStatsScopes;
  const m = card.metrics;
  const hasStats = card.linked && card.today != null;

  return (
    <section
      className="motion-safe:animate-[promotion-card_0.5s_ease-out_both] overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-sm transition-colors hover:border-primary/30"
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      {/* brand header strip */}
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          background: `linear-gradient(90deg, ${meta.color}26, ${meta.color2 ? `${meta.color2}1f` : "transparent"})`,
          borderBottom: `1px solid ${meta.color}33`,
        }}
      >
        <PlatformMark platform={card.platform} className="size-5" />
        <span className="text-sm font-semibold" style={{ color: meta.color2 ? "#fff" : meta.color }}>
          {meta.label}
        </span>
        <a
          href={platformDashboardUrl(card.platform, card.externalId)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-primary/40"
        >
          {meta.dashboardLabel.replace("Open ", "")}
          <ArrowUpRight className="size-3" />
        </a>
      </div>

      <div className="space-y-4 p-4">
        {card.linked ? (
          <>
            {/* identity row */}
            <div className="flex items-center gap-3">
              {card.imageUrl ? (
                <img
                  src={card.imageUrl}
                  alt={card.displayName ?? meta.label}
                  className="size-12 shrink-0 rounded-xl border border-border object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border"
                  style={{ background: `${meta.color}1a` }}
                >
                  <PlatformMark platform={card.platform} className="size-6" />
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {card.displayName ?? `${meta.label} profile`}
                </p>
                {card.profileUrl && (
                  <a
                    href={card.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    View profile <ExternalLink className="size-2.5" />
                  </a>
                )}
              </div>
              <DeltaChip today={card.today} yesterday={card.yesterday} metricKey={meta.growthMetric} />
            </div>

            {needsReconnect && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs text-amber-300 space-y-2">
                <p className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  Reconnect TikTok to turn on stats — followers, likes and per-video views.
                </p>
                <TiktokConnectButton card={card} onConnected={onChanged} />
              </div>
            )}

            {hasStats ? (
              <>
                {/* headline metrics */}
                <div className="grid grid-cols-3 gap-2">
                  {card.platform === "spotify" && (
                    <>
                      <StatBlock label="Followers" value={m.followers} icon={<Users className="size-3" />} />
                      <StatBlock label="Popularity" value={m.popularity} icon={<TrendingUp className="size-3" />} />
                      <StatBlock label="Tracks" value={card.items.filter((i) => i.kind === "track").length || null} icon={<Play className="size-3" />} />
                    </>
                  )}
                  {card.platform === "apple_music" && (
                    <>
                      <StatBlock label="Releases" value={m.releases} icon={<Play className="size-3" />} />
                      <div className="col-span-2 rounded-xl bg-background/50 px-3 py-2">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Latest release</div>
                        <div className="truncate text-sm font-semibold text-foreground">
                          {card.items[0]?.title ?? "—"}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {card.items[0]?.releasedAt
                            ? new Date(card.items[0].releasedAt).toLocaleDateString()
                            : ""}
                        </div>
                      </div>
                    </>
                  )}
                  {card.platform === "audiomack" && (
                    <>
                      <StatBlock label="Followers" value={m.followers} icon={<Users className="size-3" />} />
                      <StatBlock label="Uploads" value={m.uploads} icon={<Play className="size-3" />} />
                      <StatBlock label="Following" value={m.following} icon={<Heart className="size-3" />} />
                    </>
                  )}
                  {card.platform === "youtube" && (
                    <>
                      <StatBlock label="Subscribers" value={m.subscribers} icon={<Users className="size-3" />} />
                      <StatBlock label="Total views" value={m.totalViews} icon={<Eye className="size-3" />} />
                      <StatBlock label="Videos" value={m.videoCount} icon={<Play className="size-3" />} />
                    </>
                  )}
                  {card.platform === "tiktok" && (
                    <>
                      <StatBlock label="Followers" value={m.followers} icon={<Users className="size-3" />} />
                      <StatBlock label="Likes" value={m.likes} icon={<Heart className="size-3" />} />
                      <StatBlock label="Videos" value={m.videoCount} icon={<Play className="size-3" />} />
                    </>
                  )}
                  {card.platform === "boomplay" && (
                    <div className="col-span-3 rounded-xl bg-background/50 px-3 py-2.5 text-xs text-muted-foreground">
                      Boomplay exposes no public stats API — your dashboard button above opens Boomplay for Artists.
                    </div>
                  )}
                </div>

                {/* sparkline */}
                {meta.growthMetric && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>{meta.growthMetricLabel} · 7 days</span>
                      {card.lastSyncedAt && (
                        <span>Synced {new Date(card.lastSyncedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    <Sparkline points={card.spark} color={meta.color} />
                  </div>
                )}
              </>
            ) : (
              !needsReconnect && (
                <div className="rounded-xl border border-border bg-background/40 px-3 py-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Stats pending</p>
                  <p>
                    {card.configured
                      ? "First sync hasn't run yet — hit Refresh."
                      : "The stats API for this platform isn't enabled yet. Link stays active; the dashboard button works now."}
                  </p>
                  {card.missingHint && (
                    <p className="text-amber-300/90">Admin: add {card.missingHint}</p>
                  )}
                </div>
              )
            )}

            {card.lastError && (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
                Last sync issue: {card.lastError}
              </p>
            )}

            {/* top content strip — real artwork/thumbnails from the platform */}
            {card.items.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {card.platform === "youtube" || card.platform === "tiktok" ? "Recent videos" : "Top tracks & releases"}
                </p>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {card.items.slice(0, 8).map((item) => (
                    <a
                      key={item.id}
                      href={item.url ?? card.profileUrl ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group w-24 shrink-0"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          loading="lazy"
                          className="aspect-square w-24 rounded-lg border border-border object-cover transition-transform group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div
                          className="flex aspect-square w-24 items-center justify-center rounded-lg border border-border"
                          style={{ background: `${meta.color}14` }}
                        >
                          <PlatformMark platform={card.platform} className="size-7" />
                        </div>
                      )}
                      <p className="mt-1 truncate text-[11px] font-medium text-foreground">{item.title}</p>
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {item.views != null && (<><Eye className="size-2.5" />{formatCompactCount(item.views)}</>)}
                        {item.plays != null && (<><Play className="size-2.5" />{formatCompactCount(item.plays)}</>)}
                        {item.likes != null && (<><Heart className="size-2.5" />{formatCompactCount(item.likes)}</>)}
                        {item.comments != null && (<><MessageCircle className="size-2.5" />{formatCompactCount(item.comments)}</>)}
                        {item.shares != null && (<><Share2 className="size-2.5" />{formatCompactCount(item.shares)}</>)}
                        {item.releasedAt && item.views == null && item.plays == null && item.likes == null &&
                          new Date(item.releasedAt).toLocaleDateString()}
                      </p>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => syncMut.mutate()}
                disabled={syncMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
              >
                {syncMut.isPending ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Unlink ${meta.label}? Your saved stats history is removed too.`)) {
                    unlinkMut.mutate();
                  }
                }}
                disabled={unlinkMut.isPending}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-50"
              >
                {unlinkMut.isPending ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />}
                Unlink
              </button>
            </div>
          </>
        ) : (
          <>
            {/* unlinked state — visual: big mark + what you get */}
            <div className="flex items-center gap-3">
              <div
                className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border"
                style={{ background: `${meta.color}14` }}
              >
                <PlatformMark platform={card.platform} className="size-8" />
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                {card.platform === "boomplay"
                  ? "Link your Boomplay artist page for one-tap access to Boomplay for Artists."
                  : card.platform === "apple_music"
                    ? "Your catalog, latest release and artwork — straight from Apple Music."
                    : card.platform === "tiktok"
                      ? "Followers, likes and per-video views — via TikTok sign-in."
                      : `Followers, ${card.platform === "youtube" ? "views, uploads" : "top tracks"} and growth — refreshed daily.`}
              </div>
            </div>
            {!card.configured && (
              <p className="rounded-lg bg-background/50 px-3 py-2 text-[11px] text-muted-foreground">
                Live stats for {meta.label} switch on as soon as its API is enabled — linking works today.
                {card.missingHint && <span className="block text-amber-300/90">Admin: add {card.missingHint}</span>}
              </p>
            )}
            {card.platform === "tiktok" ? (
              <TiktokConnectButton card={card} onConnected={onChanged} />
            ) : (
              <ConnectForm card={card} onLinked={onChanged} />
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ── hero ─────────────────────────────────────────────────────────────────── */

const RANGE_OPTIONS = [7, 30, 90] as const;

function Hero({ cards }: { cards: PromotionCard[] }) {
  const growthCards = cards.filter((c) => c.linked && PLATFORM_META[c.platform].growthMetric);
  const [platform, setPlatform] = useState<PromotionPlatform | null>(null);
  const [days, setDays] = useState<(typeof RANGE_OPTIONS)[number]>(30);
  const activePlatform = platform ?? growthCards[0]?.platform ?? null;

  const totalAudience = cards.reduce((sum, c) => {
    return sum + (c.today?.followers ?? 0) + (c.today?.subscribers ?? 0);
  }, 0);
  const animatedTotal = useCountUp(totalAudience, 1200);
  const linkedCount = cards.filter((c) => c.linked).length;

  const growthFn = useServerFn(getPromotionGrowth);
  const growthQ = useQuery({
    queryKey: ["promotion-growth", activePlatform, days],
    queryFn: () => growthFn({ data: { platform: activePlatform!, days } }),
    enabled: activePlatform != null,
  });
  const activeMeta = activePlatform ? PLATFORM_META[activePlatform] : null;
  const chartData = useMemo(() => {
    if (!growthQ.data || !activeMeta?.growthMetric) return [];
    const key = activeMeta.growthMetric;
    return growthQ.data.points
      .map((p) => ({ day: p.day.slice(5), value: p.metrics[key] }))
      .filter((p): p is { day: string; value: number } => typeof p.value === "number");
  }, [growthQ.data, activeMeta]);

  return (
    <section className="relative z-10 mx-auto w-full max-w-5xl px-4 pt-8">
      <div className="overflow-hidden rounded-3xl border border-border bg-card/40 backdrop-blur-sm">
        <div className="border-b border-border bg-gradient-to-r from-primary/15 via-transparent to-primary/10 px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            {PROMOTION_PLATFORMS.map((p) => (
              <PlatformMark key={p} platform={p} className="size-6" />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Combined audience
              </p>
              <p className="text-4xl font-black tabular-nums tracking-tight text-foreground">
                {totalAudience > 0 ? formatCompactCount(animatedTotal) : "—"}
              </p>
            </div>
            <p className="pb-1.5 text-xs text-muted-foreground">
              {linkedCount > 0
                ? `${linkedCount} of 6 platforms linked · refreshed daily`
                : "Link your platforms below — your numbers start flowing in."}
            </p>
          </div>
        </div>

        {/* growth chart */}
        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {growthCards.map((c) => (
              <button
                key={c.platform}
                type="button"
                onClick={() => setPlatform(c.platform)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  activePlatform === c.platform
                    ? "border-primary/60 bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <PlatformMark platform={c.platform} className="size-3.5" />
                {PLATFORM_META[c.platform].shortLabel}
              </button>
            ))}
            <div className="ml-auto flex gap-1">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setDays(r)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    days === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>

          {activePlatform && activeMeta?.growthMetric ? (
            growthQ.isLoading ? (
              <div className="flex h-44 items-center justify-center">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : chartData.length > 1 ? (
              <ChartContainer
                config={{
                  value: { label: activeMeta.growthMetricLabel ?? "Value", color: activeMeta.color },
                }}
                className="h-44 w-full"
              >
                <AreaChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => formatCompactCount(v)}
                    domain={["dataMin", "dataMax"]}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-value)"
                    fill="var(--color-value)"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border">
                <PlatformMark platform={activePlatform} className="size-8 opacity-60" />
                <p className="text-xs text-muted-foreground">
                  Growth appears here after a couple of daily syncs.
                </p>
              </div>
            )
          ) : (
            <div className="flex h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border">
              <div className="flex items-center gap-2 opacity-60">
                {PROMOTION_PLATFORMS.map((p) => (
                  <PlatformMark key={p} platform={p} className="size-7" />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Link a platform with stats and this becomes your growth chart.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── signed-out explainer (visual, not a blank redirect) ──────────────────── */

function SignedOutExplainer() {
  // The auth return path reads window.location — compute it after mount so
  // SSR and the first client render agree (both start with undefined).
  const [authSearch, setAuthSearch] = useState<{ next: string } | undefined>(undefined);
  useEffect(() => {
    setAuthSearch(authNextSearch());
  }, []);
  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-14">
        <div className="overflow-hidden rounded-3xl border border-border bg-card/40 backdrop-blur-sm">
          <div className="border-b border-border bg-gradient-to-r from-primary/15 via-transparent to-primary/10 px-6 py-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-2.5">
              {PROMOTION_PLATFORMS.map((p) => (
                <PlatformMark key={p} platform={p} className="size-8" />
              ))}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Every platform. Every number. One hub.</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Followers, plays, top tracks and growth across Spotify, Apple Music, Audiomack,
              Boomplay, YouTube and TikTok — refreshed daily, inside Aurora.
            </p>
          </div>
          {/* chart frame preview — marks flowing into one graph, no fake numbers */}
          <div className="px-6 py-6">
            <svg viewBox="0 0 320 110" className="w-full" aria-hidden>
              <defs>
                <linearGradient id="explainer-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#1DB954" />
                  <stop offset="0.4" stopColor="#FFA200" />
                  <stop offset="0.7" stopColor="#FF0033" />
                  <stop offset="1" stopColor="#25F4EE" />
                </linearGradient>
              </defs>
              {[70, 46, 22].map((y) => (
                <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="currentColor" strokeOpacity="0.08" />
              ))}
              <path
                d="M4,86 C50,80 70,60 110,58 C150,56 170,66 210,44 C250,24 280,30 316,14"
                fill="none"
                stroke="url(#explainer-line)"
                strokeWidth="3"
                strokeLinecap="round"
                className="motion-safe:animate-[promotion-spark_1.6s_ease-out]"
                pathLength={1}
                strokeDasharray={1}
              />
            </svg>
            <div className="mt-6 flex justify-center">
              <Button asChild size="lg" className="rounded-full px-8 font-semibold">
                <Link to="/auth" search={authSearch}>
                  Sign in to open your Promotion hub
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

function PromotionPage() {
  const { user, loading } = useAuth();
  const search = useSearch({ from: "/promotion" });
  const qc = useQueryClient();
  const dashboardFn = useServerFn(getMyPromotionDashboard);
  const syncFn = useServerFn(syncPromotionPlatform);

  const dashboardQ = useQuery({
    queryKey: ["promotion-dashboard"],
    queryFn: () => dashboardFn(),
    enabled: !!user,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["promotion-dashboard"] });

  // TikTok OAuth callback params (?tiktok=connected|cancelled|error&msg=…)
  useEffect(() => {
    if (!user) return;
    if (search.tiktok === "connected") {
      toast.success("TikTok connected — pulling your stats now.");
      // First stats sync right after a (re)connect with the new scopes.
      void syncFn({ data: { platform: "tiktok" } }).catch(() => {}).finally(refresh);
    } else if (search.tiktok === "cancelled") {
      toast("TikTok connection cancelled.");
    } else if (search.tiktok === "error") {
      toast.error(`TikTok connection failed: ${search.msg ?? "unknown error"}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.tiktok, search.msg, user]);

  if (loading) {
    return (
      <main className="aurora-page-shell text-foreground">
        <span aria-hidden className="aurora-ambient" />
        <div className="relative z-10 flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  if (!user) return <SignedOutExplainer />;

  const cards = dashboardQ.data?.cards ?? [];

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      <header className="relative z-10 flex items-center justify-between border-b border-border bg-background/80 pl-24 pr-5 py-4 backdrop-blur-xl">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Promotion</h1>
          <p className="text-[11px] text-muted-foreground">Spotify · Apple Music · Audiomack · Boomplay · YouTube · TikTok</p>
        </div>
        {dashboardQ.isFetching && !dashboardQ.isLoading && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </header>

      {dashboardQ.isLoading ? (
        <div className="relative z-10 mx-auto w-full max-w-5xl space-y-4 px-4 pt-8 pb-16">
          <div className="h-64 animate-pulse rounded-3xl border border-border bg-card/30" />
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
            {PROMOTION_PLATFORMS.map((p) => (
              <div key={p} className="rounded-2xl border border-border bg-card/30 p-4">
                <div className="flex items-center gap-2">
                  <PlatformMark platform={p} className="size-5 opacity-50" />
                  <div className="h-3 w-20 animate-pulse rounded bg-border" />
                </div>
                <div className="mt-4 h-16 animate-pulse rounded-xl bg-border/60" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <Hero cards={cards} />
          <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-6 pb-16">
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
              {cards.map((card, i) => (
                <PlatformCard key={card.platform} card={card} index={i} onChanged={refresh} />
              ))}
            </div>
            <p className="mt-6 text-center text-[11px] text-muted-foreground">
              Public numbers only — straight from each platform, once a day. Private dashboard
              metrics (streams, revenue, watch time) stay in each platform's own artist dashboard,
              one tap away on every card.
            </p>
          </section>
        </>
      )}

      <SiteFooter />
    </main>
  );
}
