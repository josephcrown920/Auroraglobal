import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Wand2 } from "lucide-react";
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

type TemplateSearch = { open?: string; category?: string };

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

  const activeCategory = (search.category as TemplateCategory | undefined) ?? null;
  const selected = search.open ? getStudioTemplate(search.open) : undefined;

  const setCategory = (cat: TemplateCategory | null) =>
    navigate({ search: (prev) => ({ ...prev, category: cat ?? undefined }), replace: true });
  const openTemplate = (id: string) => navigate({ search: (prev) => ({ ...prev, open: id }) });
  const closeDrawer = () =>
    navigate({ search: (prev) => ({ ...prev, open: undefined }), replace: true });

  const shownCategories = activeCategory
    ? CATEGORY_ORDER.filter((c) => c === activeCategory)
    : CATEGORY_ORDER;

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      <header className="relative z-10 flex items-center justify-between border-b border-border bg-background/80 px-5 py-4 backdrop-blur-xl">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground no-underline"
        >
          <ArrowLeft className="size-4" /> Home
        </Link>
        <Link
          to="/gallery"
          className="text-sm font-medium text-primary no-underline hover:brightness-110"
        >
          My gallery
        </Link>
      </header>

      <section className="relative z-10 px-5 pb-24 pt-6">
        {/* Intro */}
        <div className="mb-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
            <Wand2 className="size-3.5" /> One-tap studio
          </span>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Pick a template.
            <span className="block aurora-gradient-text">We do the rest.</span>
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Upload a photo (and a song for lip-sync), tap generate, and your render lands in your
            gallery.
          </p>
        </div>

        {/* Viral Guides cross-link */}
        <Link
          to="/guides"
          className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 no-underline transition hover:bg-primary/10"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">
              Prefer step-by-step? Browse the Viral Guides
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Helicopter Reveal, Floating Music Cards, the Wong Kar-wai Look and more — full
              prompt walkthroughs you run at your own pace.
            </p>
          </div>
          <ArrowLeft className="size-4 shrink-0 rotate-180 text-primary" />
        </Link>

        {/* Category chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Chip active={!activeCategory} onClick={() => setCategory(null)}>
            All
          </Chip>
          {CATEGORY_ORDER.map((cat) => (
            <Chip key={cat} active={activeCategory === cat} onClick={() => setCategory(cat)}>
              {cat}
            </Chip>
          ))}
        </div>

        {/* Grouped grid */}
        <div className="space-y-8">
          {shownCategories.map((cat) => {
            const items = STUDIO_TEMPLATES.filter((t) => t.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/70">
                  <Sparkles className="size-3.5 text-primary" /> {cat}
                </h2>
                <div className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2">
                  {items.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      locked={!!t.premium && !isPro}
                      onSelect={
                        t.dispatch === "autocut"
                          ? () => navigateTo({ to: "/edit" })
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
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)]"
          : "border border-border bg-white/[0.03] text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
