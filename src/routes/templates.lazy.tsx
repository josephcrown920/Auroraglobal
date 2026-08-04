import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, BookOpen, Sparkles } from "lucide-react";
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
    <main
      className="min-h-dvh pt-[env(safe-area-inset-top)] text-foreground"
      style={{ background: "var(--gradient-page)" }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 pb-2 pt-3">
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
          {CATEGORY_ORDER.map((cat) => (
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
            const items = STUDIO_TEMPLATES.filter((t) => t.category === cat);
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
