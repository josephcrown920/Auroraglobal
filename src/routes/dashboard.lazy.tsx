import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listGenerations } from "@/lib/studio.functions";
import { getMyProfile } from "@/lib/billing.functions";
import { publishGeneration } from "@/lib/share.functions";
import { getMyTiktokAccount } from "@/lib/tiktok-posting.functions";
import { saveAssetToDisk } from "@/lib/save";
import { ShareMenu } from "@/components/share/ShareMenu";
import { ModelBadge } from "@/components/ModelBadge";
import { TiktokPostButton } from "@/components/tiktok/TiktokPostButton";
import { Sparkles, Loader2, Coins, Film, Image as ImageIcon, ArrowRight, Settings, Shield, Share2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PARTNER_COMMISSION_PCT, REFERRAL_AURA_EACH } from "@/lib/partners";
import { Button } from "@/components/ui/button";
import { ApiKeysPanel } from "@/components/dashboard/ApiKeysPanel";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

export const Route = createLazyFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const profileFn = useServerFn(getMyProfile);
  const listFn = useServerFn(listGenerations);
  const publishFn = useServerFn(publishGeneration);
  const tiktokAccountFn = useServerFn(getMyTiktokAccount);

  const { data: profile } = useQuery({ queryKey: ["profile", user?.id], queryFn: () => profileFn(), enabled: !!user });
  const { data: hist, isLoading } = useQuery({ queryKey: ["gens", user?.id], queryFn: () => listFn(), enabled: !!user });
  const { data: tiktokAccount } = useQuery({ queryKey: ["tiktok-account"], queryFn: () => tiktokAccountFn(), enabled: !!user });

  const [filter, setFilter] = useState<"all" | "images" | "videos" | "processing" | "failed">("all");

  const items = hist?.items ?? [];
  const images = items.filter((i) => i.kind === "image" && i.result_image_url);
  const videos = items.filter((i) => i.kind === "video" && i.result_video_url);
  const failed = items.filter((i) => i.status === "failed");
  const processing = items.filter((i) => i.status !== "failed" && !i.result_image_url && !i.result_video_url);

  const filteredItems = useMemo(() => {
    switch (filter) {
      case "images": return images;
      case "videos": return videos;
      case "processing": return processing;
      case "failed": return failed;
      default: return items;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- derived arrays (processing/failed) are computed inside and intentionally stable; filter+items cover meaningful reactive values
  }, [filter, items]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between pl-24 pr-6 md:pl-24 md:pr-10 py-5 border-b border-border/60 backdrop-blur-xl bg-background/40">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
          Aurora Studio
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <Link to="/studio" className="text-sm px-4 py-2 rounded-full text-primary-foreground bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)]">
            Open Studio <ArrowRight className="inline size-3.5" />
          </Link>
          {profile?.isAdmin && (
            <Link to="/admin" className="text-sm px-4 py-2 rounded-full border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1.5">
              <Shield className="size-3.5 text-amber-500" /> Admin
            </Link>
          )}
          <Link to="/settings" search={{ tiktok: undefined, msg: undefined }} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            <Settings className="size-3.5" /> Settings
          </Link>
          <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>Sign out</Button>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 py-10 space-y-10">
        <div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
            Welcome back, <span className="aurora-gradient-text">{profile?.display_name || user.email?.split("@")[0]}.</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Your gallery, your Aura, your history — all in one place.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Coins} label="Aura" value={profile?.credits ?? "—"} />
          <StatCard icon={ImageIcon} label="Images" value={images.length} />
          <StatCard icon={Film} label="Videos" value={videos.length} />
          <StatCard icon={Sparkles} label="Total shoots" value={items.length} />
        </div>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="aurora-kicker">All your generations</h2>
            {items.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: "all", label: `All (${items.length})` },
                    { key: "images", label: `Images (${images.length})` },
                    { key: "videos", label: `Videos (${videos.length})` },
                    { key: "processing", label: `In progress (${processing.length})` },
                    { key: "failed", label: `Failed (${failed.length})` },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setFilter(t.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      filter === t.key
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-card/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isLoading ? (
            <div className="text-muted-foreground text-sm">Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground mb-4">No shoots yet — let's make your first one.</p>
              <Link to="/studio" className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-primary-foreground bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)]">
                Open Studio <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nothing in this category yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredItems.map((g) => {
                const rawUrl = g.result_image_url || g.result_video_url;
                return (
                <article key={g.id} className="group rounded-2xl overflow-hidden border border-border bg-card/60 backdrop-blur-xl relative">
                  <div className="aspect-square bg-background/40">
                    {g.result_image_url ? (
                      <img src={g.result_image_url} alt={g.prompt.slice(0, 60)} className="w-full h-full object-cover" />
                    ) : g.result_video_url ? (
                      <AutoplayVideo src={g.result_video_url} className="w-full h-full object-cover" autoPlay={false} playsInline loop onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">{g.status === "failed" ? "Failed" : g.status}</div>
                    )}
                  </div>
                  {rawUrl && (
                    <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => saveAssetToDisk(rawUrl, `aurora-${g.id.slice(0, 8)}.${g.result_video_url ? "mp4" : "png"}`)}
                        className="size-8 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-background flex items-center justify-center"
                        title="Save"
                      >
                        <Download className="size-3.5" />
                      </button>
                      <ShareMenu
                        compact
                        triggerClassName="size-8 rounded-full bg-background/70 backdrop-blur-md border border-border hover:bg-primary/20 hover:border-primary/50 flex items-center justify-center"
                        getShareTarget={async () => {
                          const r = await publishFn({ data: { id: g.id } });
                          return {
                            url: `${window.location.origin}${r.url}`,
                            text: g.prompt ?? undefined,
                            assetUrl: rawUrl,
                            filename: `aurora-${g.id.slice(0, 8)}.${g.result_video_url ? "mp4" : "png"}`,
                          };
                        }}
                      />
                    </div>
                  )}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <ModelBadge model={g.model} />
                      <span className="text-[10px] text-muted-foreground">{new Date(g.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{g.prompt}</p>
                    {g.result_video_url && (
                      <TiktokPostButton
                        compact
                        videoUrl={g.result_video_url}
                        generationId={g.id}
                        title={g.prompt?.slice(0, 150)}
                        isConnected={tiktokAccount?.connected}
                      />
                    )}
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </section>

        <ApiKeysPanel />

        <section className="rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent p-6 md:p-8">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300 border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 rounded-full">
            <Share2 className="size-3" /> Aurora Partners
          </span>
          <h2 className="text-xl md:text-2xl font-semibold mt-3 leading-tight">Earn Free Aura — and {PARTNER_COMMISSION_PCT}% for life.</h2>
          <p className="text-muted-foreground text-sm mt-2 max-w-xl">
            Invite a friend and you both get +{REFERRAL_AURA_EACH} Aura. Every Aura pack your audience buys pays you {PARTNER_COMMISSION_PCT}% — recurring, no cap, paid monthly.
          </p>
          <Link
            to="/partners"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-400 text-emerald-950 text-sm font-semibold hover:bg-emerald-300 no-underline"
          >
            Earn Free Aura <ArrowRight className="size-3.5" />
          </Link>
        </section>

        <section className="aurora-panel p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Legal</h2>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link to="/legal/$slug" params={{ slug: "terms" }} className="hover:text-foreground underline-offset-4 hover:underline">Terms of Service</Link>
            <Link to="/legal/$slug" params={{ slug: "privacy" }} className="hover:text-foreground underline-offset-4 hover:underline">Privacy Policy</Link>
            <Link to="/legal/$slug" params={{ slug: "ai-policy" }} className="hover:text-foreground underline-offset-4 hover:underline">AI &amp; Content Policy</Link>
            <Link to="/legal/$slug" params={{ slug: "acceptable-use" }} className="hover:text-foreground underline-offset-4 hover:underline">Acceptable Use</Link>
            <Link to="/legal/$slug" params={{ slug: "refunds" }} className="hover:text-foreground underline-offset-4 hover:underline">Refund Policy</Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  return (
    <div className="aurora-panel p-5">
      <Icon className="size-5 text-primary mb-3" />
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}