import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listGenerations } from "@/lib/studio.functions";
import { getMyProfile } from "@/lib/billing.functions";
import { ModelBadge } from "@/components/ModelBadge";
import { Sparkles, Loader2, Coins, Film, Image as ImageIcon, ArrowRight, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ApiKeysPanel } from "@/components/dashboard/ApiKeysPanel";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "My Dashboard — Aurora" },
      { name: "description", content: "Manage your Aura balance, billing, recent generations and account settings." },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/dashboard" }],
  }),
});

function DashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const profileFn = useServerFn(getMyProfile);
  const listFn = useServerFn(listGenerations);

  const { data: profile } = useQuery({ queryKey: ["profile", user?.id], queryFn: () => profileFn(), enabled: !!user });
  const { data: hist, isLoading } = useQuery({ queryKey: ["gens", user?.id], queryFn: () => listFn(), enabled: !!user });

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  const items = hist?.items ?? [];
  const images = items.filter((i) => i.kind === "image" && i.result_image_url);
  const videos = items.filter((i) => i.kind === "video" && i.result_video_url);

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5 border-b border-border/60 backdrop-blur-xl bg-background/40">
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
          <h2 className="aurora-kicker mb-4">All your generations</h2>
          {isLoading ? (
            <div className="text-muted-foreground text-sm">Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-12 text-center">
              <p className="text-muted-foreground mb-4">No shoots yet — let's make your first one.</p>
              <Link to="/studio" className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium text-primary-foreground bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)]">
                Open Studio <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((g) => (
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
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <ModelBadge model={g.model} />
                      <span className="text-[10px] text-muted-foreground">{new Date(g.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{g.prompt}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <ApiKeysPanel />

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