import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, Camera, Film, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile } from "@/lib/billing.functions";
import {
  STUDIO_TEMPLATES,
  CATEGORY_ORDER,
  getStudioTemplate,
  type TemplateCategory,
} from "@/lib/template-studio";
import { TemplateCard } from "@/components/templates/TemplateCard";
import { TemplateDrawer } from "@/components/templates/TemplateDrawer";
import { useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { featureKeyForTemplate } from "@/lib/feature-visibility";

export const Route = createLazyFileRoute("/templates")({ component: TemplatesPage });

function TemplatesPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const navigateTo = useNavigate();

  const profileFn = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: () => profileFn(),
    enabled: !!user,
  });
  const isPro = !!(profile?.is_pro || profile?.isAdmin);

  const { showFeature } = useFeatureVisibility();

  const activeCategory = (search.category as TemplateCategory | undefined) ?? null;
  // Deep links to a gated template (e.g. old Viral Preset tags) fall back to
  // the closed state for regular users instead of opening a hidden drawer.
  const selectedRaw = search.open ? getStudioTemplate(search.open) : undefined;
  const selected =
    selectedRaw && showFeature(featureKeyForTemplate(selectedRaw)) ? selectedRaw : undefined;

  const setCategory = (cat: TemplateCategory | null) =>
    navigate({ search: { ...search, category: cat ?? undefined }, replace: true });
  const openTemplate = (id: string) => navigate({ search: { ...search, open: id } });
  const closeDrawer = () =>
    navigate({ search: { ...search, open: undefined }, replace: true });

  // Artist-only gating: drop templates whose backing feature is hidden for
  // this viewer, then drop any category chip left with zero templates.
  const visibleTemplates = STUDIO_TEMPLATES.filter((t) => showFeature(featureKeyForTemplate(t)));
  const visibleCategories = CATEGORY_ORDER.filter((c) =>
    visibleTemplates.some((t) => t.category === c),
  );
  const shownCategories = activeCategory
    ? visibleCategories.filter((c) => c === activeCategory)
    : visibleCategories;

  return (
    <main
      className="min-h-dvh pt-[env(safe-area-inset-top)] text-foreground"
      style={{ background: "var(--gradient-page)" }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between pl-24 pr-4 pb-2 pt-3">
        <Link
          to="/"
          aria-label="Back home"
          className="flex size-9 items-center justify-center rounded-full bg-card text-muted-foreground shadow-[var(--shadow-card)] no-underline transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <Link
          to="/gallery"
          className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-xs font-bold text-muted-foreground shadow-[var(--shadow-card)] no-underline transition hover:text-foreground"
        >
          <Sparkles className="size-3.5 text-brand-ink" /> My gallery
        </Link>
      </header>

      <section className="px-4 pb-24 pt-2">
        {/* Intro */}
        <div className="mb-4">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">
            Templates
          </h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            One tap — Aurora does the rest. Your render lands in your gallery.
          </p>
        </div>

        {/* Category chips */}
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={!activeCategory} onClick={() => setCategory(null)}>
            All
          </Chip>
          {visibleCategories.map((cat) => (
            <Chip key={cat} active={activeCategory === cat} onClick={() => setCategory(cat)}>
              {cat}
            </Chip>
          ))}
        </div>

        {/* Viral Guides cross-link */}
        <Link
          to="/guides"
          className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 no-underline shadow-[var(--shadow-card)] transition active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-brand-ink">
              <BookOpen className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Prefer step-by-step? Viral Guides</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Full prompt walkthroughs you run at your own pace.
              </p>
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>

        {/* Grouped strips */}
        <div className="space-y-7">
          {shownCategories.map((cat) => {
            const items = visibleTemplates.filter((t) => t.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <div className="mb-2.5 flex items-baseline justify-between">
                  <h2 className="text-[15px] font-bold tracking-tight">{cat}</h2>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {items.length} template{items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
                  {cat === shownCategories[0] && (
                    <DirectYourShootCard onSelect={() => navigateTo({ to: "/scene-builder" })} />
                  )}
                  {items.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      locked={!!t.premium && !isPro}
                      onSelect={
                        t.dispatch === "autocut"
                          ? () =>
                              navigateTo({
                                to: "/edit",
                                search: t.autocutStyle ? { style: t.autocutStyle } : {},
                              })
                          : t.dispatch === "beat-reel"
                          ? () => navigateTo({ to: "/beat-reel" })
                          : () => openTemplate(t.id)
                      }
                      className="w-40 shrink-0 snap-start"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {selected && (
        <TemplateDrawer
          template={selected}
          locked={!!selected.premium && !isPro}
          onClose={closeDrawer}
        />
      )}
    </main>
  );
}

/** Quick-access shortcut into the Scene Builder — always the first card in the grid. */
function DirectYourShootCard({ onSelect }: { onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative w-40 shrink-0 snap-start overflow-hidden rounded-2xl bg-card text-left shadow-[var(--shadow-card)] transition-transform active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-violet-600/40 via-violet-950 to-black">
        {/* SHOOT badge */}
        <span className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-violet-500/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-[var(--shadow-glow-soft)] backdrop-blur">
          <Camera className="size-2.5" /> Shoot
        </span>
        {/* Mini reference-slot mockup */}
        <div className="absolute inset-x-3 top-1/2 grid -translate-y-1/2 grid-cols-3 gap-1.5">
          {["You", "Outfit", "Scene"].map((label) => (
            <div
              key={label}
              className="flex items-end justify-center rounded-md border border-violet-300/30 bg-violet-300/10 pb-1"
              style={{ aspectRatio: "3/4" }}
            >
              <span className="text-[7px] font-bold uppercase tracking-wider text-violet-200/70">{label}</span>
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="flex items-center gap-1.5">
            <Film className="size-3.5 text-violet-300" />
            <span className="text-[13px] uppercase tracking-[0.14em] text-white/70">Scene Builder</span>
          </div>
          <h3 className="mt-0.5 text-sm font-semibold text-white leading-tight">Direct Your Shoot</h3>
        </div>
      </div>
      <div className="p-3">
        <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
          Drop your references — we'll stage the studio.
        </p>
      </div>
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
        active
          ? "text-white"
          : "bg-card text-muted-foreground shadow-[var(--shadow-card)] hover:text-foreground"
      }`}
      style={active ? { background: "var(--gradient-cta)" } : undefined}
    >
      {children}
    </button>
  );
}
