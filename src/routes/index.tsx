import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import {
  ArrowUp,
  Image as ImageIcon,
  Plus,
  Sparkles,
  Video,
} from "lucide-react";
import { useRef, useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile } from "@/lib/billing.functions";
import { track } from "@/lib/tracking";
import { EditableCopy } from "@/components/EditableCopy";
import { AuroraToolsSheet } from "@/components/AuroraToolsSheet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aurora — Turn Your Phone Recording into a Cinematic Music Video" },
      { name: "description", content: "Create videos that look like a $50,000 production — for a fraction of the cost. Aurora is the AI studio built for music artists and creators. No crew, no studio, no waiting." },
      { property: "og:title", content: "Aurora — Turn Your Phone Recording into a Cinematic Music Video" },
      { property: "og:description", content: "Create videos that look like a $50,000 production — for a fraction of the cost. Aurora is the AI studio built for music artists and creators. No crew, no studio, no waiting." },
      { property: "og:url", content: CANONICAL_ORIGIN },
    ],
    links: [{ rel: "canonical", href: CANONICAL_ORIGIN }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Who owns the rights to what I generate?",
              acceptedAnswer: { "@type": "Answer", text: "You do. Every generation on Aurora is 100% owned by the artist who created it. Commercial rights are included on Creator and Pro plans from the first export." },
            },
            {
              "@type": "Question",
              name: "What is the difference between Creator and Pro?",
              acceptedAnswer: { "@type": "Answer", text: "Creator ($25/month) gives you clean exports, full video access, and 1,000 Aura per month — enough for regular creators. Pro ($79/month) adds priority rendering, the highest-quality models, 5,000 Aura per month, and full commercial use rights." },
            },
            {
              "@type": "Question",
              name: "Is Aurora training on my uploads?",
              acceptedAnswer: { "@type": "Answer", text: "No. Aurora runs a closed-loop model. Your references and prompts are never used for training unless you explicitly opt in to a private model for your project." },
            },
            {
              "@type": "Question",
              name: "Can I export 4K stills and video?",
              acceptedAnswer: { "@type": "Answer", text: "Yes. Creator and Pro plans include full-resolution exports for music-video backgrounds, tour visuals, and DSP canvas loops. Pro unlocks priority rendering and the highest-quality models." },
            },
            {
              "@type": "Question",
              name: "Do I need any design or prompting experience?",
              acceptedAnswer: { "@type": "Answer", text: "No. Aurora is a director-first interface — describe the shoot in plain language and drop references. It handles the technical craft." },
            },
          ],
        }),
      },
    ],
  }),
  component: LandingPage,
});

// ── Slide data ─────────────────────────────────────────────────────────────────
// Each slide maps copy keys (editable via admin panel) to hero images and routes.

type Slide = {
  id: string;
  img: string;
  eyebrowKey: string; eyebrowDefault: string;
  badgeKey?: string;  badgeDefault?: string;
  headlineKey: string; headlineDefault: string;
  subKey: string;      subDefault: string;
  ctaKey: string;      ctaDefault: string;
  ctaTo: string;
  btnLabel: string;
  btnTo: string;
};

const SLIDES: Slide[] = [
  {
    id: "ai-director",
    img: "/hero/hero-multiangle.jpg",
    eyebrowKey: "landing_hero_0_eyebrow",   eyebrowDefault: "AI CREATIVE DIRECTOR",
    badgeKey: "landing_hero_0_badge",         badgeDefault: "★ PRO",
    headlineKey: "landing_hero_0_headline",  headlineDefault: "Every Shot. Every Angle. Every Scene Directed By AI.",
    subKey: "landing_hero_0_sub",            subDefault: "Chat your idea. Aurora turns it into a complete production script, shot list, locations, performances, edits, and final delivery without hiring a director or crew.",
    ctaKey: "landing_hero_0_cta",            ctaDefault: "Director's Room →",
    ctaTo: "/scene-builder",
    btnLabel: "Start creating", btnTo: "/home",
  },
  {
    id: "visual-identity",
    img: "/hero/hero-1.png",
    eyebrowKey: "landing_hero_1_eyebrow",   eyebrowDefault: "BY ARTISTS, FOR ARTISTS",
    headlineKey: "landing_hero_1_headline",  headlineDefault: "Film Yourself. Aurora Builds the World.",
    subKey: "landing_hero_1_sub",            subDefault: "Aurora's Motion Control reads your real performance from a 30-second phone clip and places you in any cinematic scene on earth — style, motion, energy intact. No studio. No crew. No budget.",
    ctaKey: "landing_hero_1_cta",            ctaDefault: "Perform From Anywhere →",
    ctaTo: "/motion",
    btnLabel: "Open Studio", btnTo: "/home",
  },
  {
    id: "perform-anywhere",
    img: "/hero/hero-perform-anywhere.png",
    eyebrowKey: "landing_hero_2_eyebrow",   eyebrowDefault: "PERFORM ANYWHERE",
    badgeKey: "landing_hero_2_badge",         badgeDefault: "★ PRO",
    headlineKey: "landing_hero_2_headline",  headlineDefault: "Turn a 30-Second Phone Recording Into a Cinematic Music Video.",
    subKey: "landing_hero_2_sub",            subDefault: "Stop renting studios, hiring crews, and waiting weeks for edits. Record yourself for 30 seconds on your phone. Aurora transforms your performance into cinematic music videos that look like a major production.",
    ctaKey: "landing_hero_2_cta",            ctaDefault: "Perform Anywhere →",
    ctaTo: "/motion",
    btnLabel: "Start creating", btnTo: "/home",
  },
  {
    id: "tiktok30",
    img: "/hero/hero-tiktok30.jpg",
    eyebrowKey: "landing_hero_3_eyebrow",   eyebrowDefault: "TIKTOK 30",
    headlineKey: "landing_hero_3_headline",  headlineDefault: "Go Viral Without Running Out Of Content.",
    subKey: "landing_hero_3_sub",            subDefault: "Turn one idea into an entire month of scroll-stopping content. Aurora creates 30 unique TikToks, lyric videos, teasers, cover reveals, reels, and promo posts ready to publish.",
    ctaKey: "landing_hero_3_cta",            ctaDefault: "TikTok 30 →",
    ctaTo: "/spin",
    btnLabel: "Open TikTok 30", btnTo: "/spin",
  },
  {
    id: "colors-studio",
    img: "/hero/hero-colors.png",
    eyebrowKey: "landing_hero_4_eyebrow",   eyebrowDefault: "COLORS STUDIO",
    headlineKey: "landing_hero_4_headline",  headlineDefault: "One Performance. Unlimited Visual Worlds.",
    subKey: "landing_hero_4_sub",            subDefault: "Record one 30-second performance. Aurora rebuilds it into endless cinematic stages, lighting styles, outfits, moods and color worlds ready for every release.",
    ctaKey: "landing_hero_4_cta",            ctaDefault: "Explore Colors Studio →",
    ctaTo: "/colors",
    btnLabel: "Open Studio", btnTo: "/colors",
  },
  {
    id: "press-ready",
    img: "/hero/hero-new-1.png",
    eyebrowKey: "landing_hero_5_eyebrow",   eyebrowDefault: "PRESS READY",
    headlineKey: "landing_hero_5_headline",  headlineDefault: "Look Like The Biggest Artist In Your City.",
    subKey: "landing_hero_5_sub",            subDefault: "Create magazine-quality press photos, tour posters, album covers, and promotional visuals in minutes — not weeks.",
    ctaKey: "landing_hero_5_cta",            ctaDefault: "Create Press Photos →",
    ctaTo: "/live-studio",
    btnLabel: "Open Studio", btnTo: "/home",
  },
];

const SLIDE_INTERVAL_MS = 5000;

// ── Component ──────────────────────────────────────────────────────────────────

function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mode, setMode] = useState<"image" | "video">("image");
  const [idea, setIdea] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Carousel state
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const profileFn = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn(),
    enabled: !!user,
  });
  const credits = profile?.credits ?? null;

  // Auto-advance
  const advance = useCallback((dir: 1 | -1 = 1) => {
    setIdx(i => (i + dir + SLIDES.length) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (paused) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => advance(1), SLIDE_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, advance]);

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 40) advance(dx < 0 ? 1 : -1);
    touchStartX.current = null;
    // Resume auto-advance after 8s
    setTimeout(() => setPaused(false), 8000);
  };

  const submitIdea = () => {
    const text = idea.trim();
    void track("landing_composer_submit", { mode, hasText: text.length > 0 });
    if (mode === "video") {
      void navigate({ to: "/motion", search: text ? { prompt: text } : {} });
    } else {
      void navigate({ to: "/studio", search: text ? { q: text } : {} });
    }
  };

  const slide = SLIDES[idx]!;

  return (
    <div
      className="relative h-dvh w-full overflow-hidden select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Slide backgrounds (pre-rendered, faded) ────────────────────────── */}
      {SLIDES.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === idx ? 1 : 0, zIndex: i === idx ? 1 : 0 }}
        >
          <img
            src={s.img}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover object-top"
            loading={i === 0 ? "eager" : "lazy"}
          />
          {/* Gradient: light at top for header, heavy at bottom for copy */}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.75) 75%, rgba(0,0,0,0.92) 100%)"
          }} />
        </div>
      ))}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}>
        <span className="font-serif italic text-lg font-semibold text-white/90 tracking-wide">Aurora</span>
        <div className="flex items-center gap-2">
          <Link to="/partners"
            className="text-sm font-semibold text-white/80 no-underline hover:text-white transition-colors px-1">
            Partners
          </Link>
          <Link
            to={user ? "/home" : "/auth"}
            onClick={() => void track("landing_header_cta")}
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white no-underline transition-all"
            style={{ background: "var(--gradient-cta)" }}
          >
            <Plus className="size-3.5" strokeWidth={3} />
            Open Studio
          </Link>
        </div>
      </header>

      {/* ── Slide content ──────────────────────────────────────────────────── */}
      <div className="absolute inset-x-0 z-10 px-6"
        style={{ bottom: "calc(9.5rem + env(safe-area-inset-bottom))" }}>

        {/* Eyebrow + badge */}
        <div className="flex items-center gap-2.5 mb-3">
          <span className="inline-block size-2 shrink-0 rounded-full bg-[#e84855]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-white/80 italic">
            <EditableCopy copyKey={slide.eyebrowKey} fallback={slide.eyebrowDefault} />
          </span>
          {slide.badgeKey && (
            <span className="rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70 backdrop-blur-sm">
              <EditableCopy copyKey={slide.badgeKey} fallback={slide.badgeDefault ?? ""} />
            </span>
          )}
        </div>

        {/* Headline */}
        <h1 className="font-serif italic text-[32px] font-bold leading-[1.08] tracking-tight text-white">
          <EditableCopy copyKey={slide.headlineKey} fallback={slide.headlineDefault} />
        </h1>

        {/* Body */}
        <p className="mt-3 text-[14.5px] leading-relaxed font-semibold text-white/80">
          <EditableCopy copyKey={slide.subKey} fallback={slide.subDefault} />
        </p>

        {/* CTA text link */}
        <Link
          to={slide.ctaTo as "/"}
          onClick={() => void track("landing_slide_cta", { slide: slide.id })}
          className="mt-3 inline-block text-[14px] font-bold text-[#6fa3ef] no-underline hover:text-white transition-colors"
        >
          <EditableCopy copyKey={slide.ctaKey} fallback={slide.ctaDefault} />
        </Link>

        {/* Primary button */}
        <div className="mt-4">
          <Link
            to={user ? (slide.btnTo as "/") : "/auth"}
            onClick={() => void track("landing_slide_btn", { slide: slide.id })}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-bold text-white no-underline shadow-lg transition-transform active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg, #e84855, #c03040)" }}
          >
            <Plus className="size-4" strokeWidth={3} />
            {slide.btnLabel}
          </Link>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
            Free to start · No card needed
          </p>
        </div>

        {/* Dot indicators */}
        <div className="mt-5 flex items-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => { setIdx(i); setPaused(true); setTimeout(() => setPaused(false), 8000); }}
              className="transition-all duration-300"
              style={{
                height: 3,
                width: i === idx ? 28 : 10,
                borderRadius: 99,
                background: i === idx ? "#fff" : "rgba(255,255,255,0.35)",
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Sticky composer (pinned above bottom safe area) ─────────────────── */}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <div
          className="px-4 pt-3 backdrop-blur-xl"
          style={{
            background: "rgba(8,6,18,0.72)",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex items-center gap-2">
            <Link
              to={user ? "/billing" : "/auth"}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-[13px] font-bold text-white/90 shadow no-underline"
            >
              <Sparkles className="size-4 text-[#a78bfa]" />
              {user && credits !== null ? `${credits} Aura` : "5 free Aura"}
            </Link>
            <div className="flex items-center gap-1 rounded-full bg-white/10 p-1 shadow">
              <button
                type="button"
                onClick={() => setMode("image")}
                aria-pressed={mode === "image"}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all ${
                  mode === "image" ? "bg-[#7c3aed] text-white" : "text-white/60"
                }`}
              >
                <ImageIcon className="size-4" /> Image
              </button>
              <button
                type="button"
                onClick={() => setMode("video")}
                aria-pressed={mode === "video"}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all ${
                  mode === "video" ? "bg-[#7c3aed] text-white" : "text-white/60"
                }`}
              >
                <Video className="size-4" /> Video
              </button>
            </div>
          </div>

          <form
            className="mt-2.5 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 border border-white/10"
            onSubmit={(e) => { e.preventDefault(); submitIdea(); }}
          >
            <button
              type="button"
              aria-label="Open studio"
              onClick={() => void navigate({ to: "/studio" })}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
            >
              <Plus className="size-5" />
            </button>
            <input
              ref={inputRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Enter your ideas"
              aria-label="Describe your idea"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
            />
            <button
              type="submit"
              aria-label={mode === "video" ? "Create video" : "Create image"}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: "var(--gradient-cta)" }}
            >
              <ArrowUp className="size-5" strokeWidth={2.4} />
            </button>
          </form>
        </div>
      </div>

      <AuroraToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </div>
  );
}
