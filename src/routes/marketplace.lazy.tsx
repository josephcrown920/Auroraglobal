import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile } from "@/lib/billing.functions";
import {
  listApprovedMarketplaceTemplates,
  type MarketplaceTemplate,
} from "@/lib/marketplace.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Store,
  ArrowLeft,
  Search,
  Sparkles,
  Loader2,
  Star,
  Coins,
  Upload,
} from "lucide-react";

export const Route = createLazyFileRoute("/marketplace")({ component: MarketplacePage });

const CATEGORIES = ["All", "Portrait & Colors", "Music & Lip-sync", "Cinema", "Product & App", "Other"];

function MarketplacePage() {
  const { user } = useAuth();
  const { showFeature } = useFeatureVisibility();
  const navigate = useNavigate();

  const profileFn = useServerFn(getMyProfile);
  const listFn = useServerFn(listApprovedMarketplaceTemplates);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["marketplace-templates"],
    queryFn: () => listFn(),
    staleTime: 5 * 60_000,
  });

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [confirming, setConfirming] = useState<MarketplaceTemplate | null>(null);

  // On confirm: navigate to canvas with the template ID only — no charge here.
  // The template graph is fetched for free server-side by canvas.tsx;
  // Aura is deducted only when the user first clicks "Run pipeline" in canvas.
  function handleConfirmUse() {
    if (!confirming) return;
    setConfirming(null);
    navigate({
      to: "/canvas",
      search: { marketplaceTemplateId: confirming.id } as Record<string, string>,
    });
  }

  const filtered = templates.filter((t) => {
    const matchCat = category === "All" || t.category === category;
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      <header className="relative z-10 flex items-center justify-between border-b border-border bg-background/80 pl-24 pr-5 py-4 backdrop-blur-xl">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground no-underline"
        >
          <ArrowLeft className="size-4" /> Home
        </Link>
        <div className="flex items-center gap-3">
          {user && showFeature("creator-hub") && (
            <Link
              to="/creator/dashboard"
              className="flex items-center gap-1.5 text-sm font-medium text-primary no-underline hover:brightness-110"
            >
              <Upload className="size-3.5" /> Creator dashboard
            </Link>
          )}
          {!user && (
            <Link to="/auth" search={authNextSearch()} className="text-sm text-muted-foreground hover:text-foreground no-underline">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="relative z-10 px-5 pb-24 pt-6 max-w-3xl mx-auto w-full">
        <div className="mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
            <Store className="size-3.5" /> Creator Marketplace
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Templates by creators.
            <span className="block aurora-gradient-text">Built for you.</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            Browse canvas templates made by the Aurora creator community. Pick one, pay the Aura fee, and it loads straight into your canvas.
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  category === cat
                    ? "bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)]"
                    : "border border-border bg-white/[0.03] text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
            <Loader2 className="size-4 animate-spin" /> Loading marketplace…
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="rounded-2xl border border-border bg-card/30 p-10 text-center space-y-3">
            <Store className="size-10 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">
              {templates.length === 0
                ? "No approved templates yet. Be the first to submit one!"
                : "No templates match your search."}
            </p>
            {user && showFeature("creator-hub") && (
              <Link to="/creator/dashboard">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Upload className="size-3.5" /> Submit a template
                </Button>
              </Link>
            )}
          </div>
        )}

        <div className="space-y-3">
          {filtered.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onUse={() => {
                if (!user) {
                  navigate({ to: "/auth", search: authNextSearch() });
                  return;
                }
                setConfirming(t);
              }}
            />
          ))}
        </div>
      </section>

      {/* Confirm dialog */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setConfirming(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Load this template?</h2>
              <p className="text-sm text-muted-foreground">{confirming.name}</p>
            </div>

            <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Charged per run</span>
                <span className="font-semibold flex items-center gap-1">
                  <Coins className="size-3.5 text-primary" /> {confirming.run_cost_aura} Aura
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creator</span>
                <span>{confirming.creator_display_name ?? "Creator"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your balance</span>
                <span>{profile?.credits ?? "—"} Aura</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              The template loads into your canvas for free. The Aura fee is deducted when you click <strong>Run pipeline</strong>. Each node also charges its normal per-generation rate.
            </p>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setConfirming(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={handleConfirmUse}
              >
                <Sparkles className="size-4" /> Load template
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function TemplateCard({
  template: t,
  onUse,
}: {
  template: MarketplaceTemplate;
  onUse: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/30 hover:border-primary/30 transition-colors p-4 flex gap-4">
      {t.thumbnail_url ? (
        <img
          src={t.thumbnail_url}
          alt={t.name}
          className="w-20 h-20 rounded-xl object-cover shrink-0 border border-border"
        />
      ) : (
        <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Store className="size-7 text-muted-foreground/30" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm">{t.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
          </div>
          <div className="flex items-center gap-1 text-primary text-sm font-semibold shrink-0">
            <Coins className="size-3.5" /> {t.run_cost_aura}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t.category}</span>
          {t.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              {tag}
            </span>
          ))}
          <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
            <Star className="size-2.5 fill-current" /> {t.run_count} runs
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            by <span className="text-foreground/80">{t.creator_display_name ?? "Creator"}</span>
          </span>
          <Button size="sm" onClick={onUse} className="gap-1 h-7 text-xs px-3">
            <Sparkles className="size-3" /> Use
          </Button>
        </div>
      </div>
    </div>
  );
}
