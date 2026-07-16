import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";

type GuideCard = {
  slug: string;
  emoji: string;
  title: string;
  tagline: string;
  category: string;
  steps: number;
};

const GUIDES: GuideCard[] = [
  {
    slug: "phone-lipsync-performance",
    emoji: "📱",
    title: "Phone Lip Sync Performance",
    tagline: "Looks like someone caught you performing on their phone — at any location.",
    category: "Performance",
    steps: 4,
  },
  {
    slug: "colors-style-performance",
    emoji: "🎤",
    title: "Colors-Style Performance Video",
    tagline: "Bold single-color set, hanging vintage mic, wide angle and close-up — your phone does the performing.",
    category: "Performance",
    steps: 6,
  },
  {
    slug: "luxury-car-music-video",
    emoji: "🚘",
    title: "Luxury Car Music Video",
    tagline: "Put yourself inside a Maybach, Rolls, or private jet — then animate it with your real movements.",
    category: "Music Video",
    steps: 5,
  },
  {
    slug: "one-scene-every-angle",
    emoji: "🎬",
    title: "One Scene, Every Angle",
    tagline: "5 reference images → one cinematic base scene → unlimited camera angles, all animated.",
    category: "Music Video",
    steps: 5,
  },
  {
    slug: "collage-music-video",
    emoji: "🎞️",
    title: "AI Collage Music Video",
    tagline: "Multi-panel — eyes, lip sync, full body, featured model — all animated and synced to your track.",
    category: "Music Video",
    steps: 5,
  },
  {
    slug: "create-your-ai-artist",
    emoji: "🎭",
    title: "Create Your AI Artist",
    tagline: "Build a complete AI artist identity in 4 steps: base character → De-AI → scene library → animation.",
    category: "AI Artist",
    steps: 6,
  },
];

export function GuidesTeaser() {
  return (
    <section className="relative px-6 md:px-12 py-16" id="guides">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-semibold tracking-[0.18em] uppercase mb-3">
              <BookOpen className="size-3.5" /> Playbooks
            </div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
              Step-by-step viral guides
            </h2>
            <p className="mt-2 text-white/55 text-sm max-w-xl leading-relaxed">
              Distilled from real viral AI music video workflows by{" "}
              <span className="text-white/75 font-medium">@therealwavman</span>. Follow any guide
              start-to-finish inside Aurora — no prompting experience needed.
            </p>
          </div>
          <Link
            to="/guides"
            className="inline-flex items-center gap-2 shrink-0 px-5 py-2.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-white/80 text-sm font-medium no-underline transition-colors"
          >
            All guides <ArrowRight className="size-4" />
          </Link>
        </div>

        {/* Cards grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GUIDES.map((guide) => (
            <Link
              key={guide.slug}
              to="/guides/$slug"
              params={{ slug: guide.slug }}
              className="group relative flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] hover:border-primary/40 hover:bg-white/[0.06] p-5 no-underline transition-all duration-200"
            >
              {/* Emoji + category */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl">
                  {guide.emoji}
                </div>
                <span className="mt-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/40">
                  {guide.category}
                </span>
              </div>

              {/* Title */}
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-primary transition-colors">
                  {guide.title}
                </h3>
                <p className="mt-1.5 text-xs text-white/50 leading-relaxed">
                  {guide.tagline}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/30">
                  {guide.steps} steps
                </span>
                <ArrowRight className="size-3.5 text-white/30 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>

              {/* Hover glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(270 80% 60% / 0.06), transparent 70%)" }} />
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 text-center">
          <Link
            to="/guides"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm text-white no-underline bg-[image:var(--gradient-hero)] hover:brightness-110 shadow-[var(--shadow-glow-soft)] transition-all hover:scale-[1.02]"
          >
            <BookOpen className="size-4" /> Open all playbooks
          </Link>
          <p className="mt-3 text-[11px] text-white/30">
            16 guides · image generation, motion control, lip sync, AI artist workflows
          </p>
        </div>
      </div>
    </section>
  );
}
