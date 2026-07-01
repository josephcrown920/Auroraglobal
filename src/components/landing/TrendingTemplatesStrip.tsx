import { Link } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { Sparkles, ArrowRight, Crown } from "lucide-react";
import { track } from "@/lib/tracking";
import { STUDIO_TEMPLATES, templateCost } from "@/lib/template-studio";

// A curated "trending" subset, deep-linking straight into the template drawer.
// AutoCut ("autocut-hype") routes to /edit instead of the template drawer.
const TRENDING_IDS = [
  "concert-lipsync",
  "cinematic-reel",
  "ugc-talking-ad",
  "autocut-hype",
  "viral-spin",
  "kids-storybook",
];

const TRENDING = TRENDING_IDS.map((id) => STUDIO_TEMPLATES.find((t) => t.id === id)).filter(
  (t): t is (typeof STUDIO_TEMPLATES)[number] => !!t,
);

export function TrendingTemplatesStrip() {
  return (
    <section className="relative z-10 px-6 md:px-12 py-8">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
            <Sparkles className="size-3.5" /> Trending now
          </span>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">One tap. One viral clip.</h2>
        </div>
        <Link
          to="/templates"
          onClick={() => void track("trending_templates_seeall")}
          className="inline-flex items-center gap-1 text-sm text-white/70 no-underline hover:text-white"
        >
          See all <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 md:mx-0 md:px-0">
        {TRENDING.map((t) => (
          <Link
            key={t.id}
            to={t.dispatch === "autocut" ? "/edit" : "/templates"}
            search={t.dispatch === "autocut" ? undefined : { open: t.id }}
            onClick={() => void track("trending_template_click", { id: t.id })}
            className="group relative w-40 shrink-0 snap-start overflow-hidden rounded-2xl aurora-card no-underline"
          >
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
              {t.thumbnailVideo ? (
                <AutoplayVideo
                  src={t.thumbnailVideo}
                  poster={t.thumbnail}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                />
              ) : (
                <img
                  src={t.thumbnail}
                  alt={t.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              {templateCost(t) > 0 ? (
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[11px] font-semibold text-primary-foreground backdrop-blur">
                  <Sparkles className="size-3" /> {templateCost(t)}
                </span>
              ) : (
                <span className="absolute right-2 top-2 inline-flex items-center rounded-full bg-emerald-500/90 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                  Free
                </span>
              )}
              {t.premium && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-primary backdrop-blur">
                  <Crown className="size-2.5" /> Pro
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-2.5">
                <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-white/60">
                  {t.category}
                </div>
                <div className="text-sm font-semibold leading-tight text-white">{t.title}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
