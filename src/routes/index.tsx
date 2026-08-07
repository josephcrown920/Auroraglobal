import { createFileRoute, Link } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import { Plus, Play, ArrowUpRight, ChevronDown, Sparkles, Palette, Film, Wand2, Mic, Music2, Brush, Megaphone, UserCircle2, Workflow, Layers, Flame, Clapperboard, Check, Zap, Crown, Download } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { track } from "@/lib/tracking";
import { ViralEngine } from "@/components/landing/ViralEngine";
import { BalloonLipsync } from "@/components/landing/BalloonLipsync";
import { AdminLandingEditor } from "@/components/AdminLandingEditor";
import { EditableCopy } from "@/components/EditableCopy";

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
              acceptedAnswer: {
                "@type": "Answer",
                text: "You do. Every generation on Aurora is 100% owned by the artist who created it. Commercial rights are included on Creator and Pro plans from the first export.",
              },
            },
            {
              "@type": "Question",
              name: "What is the difference between Creator and Pro?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Creator ($25/month) gives you clean exports, full video access, and 1,000 Aura per month — enough for regular creators. Pro ($79/month) adds priority rendering, the highest-quality models, 5,000 Aura per month, and full commercial use rights.",
              },
            },
            {
              "@type": "Question",
              name: "Is Aurora training on my uploads?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. Aurora runs a closed-loop model. Your references and prompts are never used for training unless you explicitly opt in to a private model for your project.",
              },
            },
            {
              "@type": "Question",
              name: "Can I export 4K stills and video?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Creator and Pro plans include full-resolution exports for music-video backgrounds, tour visuals, and DSP canvas loops. Pro unlocks priority rendering and the highest-quality models.",
              },
            },
            {
              "@type": "Question",
              name: "Do I need any design or prompting experience?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "No. Aurora is a director-first interface — describe the shoot in plain language and drop references. It handles the technical craft.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: LandingPage,
});

const HERO_SLIDES = [
  {
    src: "/hero/hero-perform-anywhere.png",
    eyebrow: "PERFORM ANYWHERE",
    badge: "★ Pro",
    headline: "Turn a 30-Second Phone Recording Into a Cinematic Music Video.",
    sub: "Stop renting studios, hiring crews, and waiting weeks for edits. Record yourself for 30 seconds on your iPhone or any device with a clear camera. Aurora transforms your performance into cinematic music videos, performances, and visuals that look like they were directed by a major production team.",
    cta: "Perform Anywhere →",
    ctaTo: "/motion",
  },
  {
    src: "/hero/hero-tiktok30.jpg",
    eyebrow: "TikTok 30",
    headline: "Go Viral Without Running Out Of Content.",
    sub: "Turn one idea into an entire month of scroll-stopping content. Aurora creates 30 unique TikToks, lyric videos, teasers, cover reveals, reels, and promo posts ready to publish.",
    cta: "TikTok 30 →",
    ctaTo: "/spin",
  },
  {
    src: "/hero/hero-colors.png",
    eyebrow: "Colors Studio",
    headline: "One Performance. Unlimited Visual Worlds.",
    sub: "Record one 30-second performance. Aurora rebuilds it into endless cinematic stages, lighting styles, outfits, moods and color worlds ready for every release.",
    cta: "Explore Colors Studio →",
    ctaTo: "/colors",
  },
  {
    src: "/hero/hero-7.png",
    eyebrow: "Press Ready",
    headline: "Look Like The Biggest Artist In Your City.",
    sub: "Create magazine-quality press photos, tour posters, album covers, and promotional visuals in minutes—not weeks.",
    cta: "Create Press Photos →",
    ctaTo: "/music-video",
  },
];

const FEATURED_TOOLS = [
  {
    label: "Motion Control",
    desc: "Transfer your real 30-second performance into any AI scene.",
    to: "/motion",
    icon: Wand2,
    price: "From 300 Aura",
  },
  {
    label: "Perform Anywhere",
    desc: "Phone performance + avatar + outfit + scene → cinematic video, anywhere.",
    to: "/motion",
    icon: Film,
    price: "From 400 Aura",
  },
  {
    label: "Colors Performance Sessions",
    desc: "Direct your palette across cyc, indoor and rooftop performance sets.",
    to: "/colors",
    icon: Palette,
    price: "From 10 Aura",
  },
  {
    label: "Get Ready With Me",
    desc: "Outfit swap talking GRWM reels straight from a single selfie.",
    to: "/studio",
    icon: UserCircle2,
    price: "From 5 Aura",
  },
  {
    label: "TikTok30 UGC Factory",
    desc: "Create 30 campaign posts, animate any result, or send it to Motion Control.",
    to: "/spin",
    icon: Flame,
    price: "85 Aura",
  },
  {
    label: "Talking Avatar Studio",
    desc: "Write the script, choose the face and voice, then generate a camera-ready avatar video.",
    to: "/avatar",
    icon: UserCircle2,
    price: "From 100 Aura",
  },
];

// Silence unused-import warnings for icons kept for future use
((_: unknown) => _)([Mic, Music2, Brush, Megaphone, Workflow, Layers, Clapperboard]);

const TICKER_ITEMS = [
  "Go viral in 30 seconds",
  "$50K look · zero crew",
  "30s phone clip → cinematic reel",
  "10 hours saved every week",
  "1,000+ artists scaled",
  "No crew · No studio",
  "Phone recording → music video",
  "Director's chair · your phone",
];

const FAQS = [
  {
    q: "Who owns the rights to what I generate?",
    a: "You do. Every generation on Aurora is 100% owned by the artist who created it. Commercial rights are included on Creator and Pro plans from the first export.",
  },
  {
    q: "What's the difference between Creator and Pro?",
    a: "Creator ($25/month) gives you clean exports, full video access, and 1,000 Aura per month — enough for regular creators. Pro ($79/month) adds priority rendering, the highest-quality models, 5,000 Aura per month, and full commercial use rights.",
  },
  {
    q: "Is Aurora training on my uploads?",
    a: "No. Aurora runs a closed-loop model. Your references and prompts are never used for training unless you explicitly opt in to a private model for your project.",
  },
  {
    q: "Can I export 4K stills and video?",
    a: "Yes. Creator and Pro plans include full-resolution exports for music-video backgrounds, tour visuals, and DSP canvas loops. Pro unlocks priority rendering and the highest-quality models.",
  },
  {
    q: "Do I need any design or prompting experience?",
    a: "No. Aurora is a director-first interface — describe the shoot in plain language and drop references. It handles the technical craft.",
  },
];

function usePwaInstall() {
  const promptRef = useRef<Event & { prompt: () => Promise<void> } | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as Event & { prompt: () => Promise<void> };
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!promptRef.current) return;
    await promptRef.current.prompt();
    promptRef.current = null;
    setCanInstall(false);
  };

  return { canInstall, install };
}

function LandingPage() {
  const { user } = useAuth();
  const ctaTo = user ? "/home" : "/auth";
  const { canInstall, install } = usePwaInstall();

  const [slideIdx, setSlideIdx] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % HERO_SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-display antialiased selection:bg-[#8b5cf6] selection:text-white">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="absolute top-0 left-0 right-0 z-40 w-full">
        <div className="flex h-14 items-center justify-end px-5">
          <div className="flex items-center gap-3">
            {canInstall && (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                <Download className="size-3 shrink-0" />
                Install
              </button>
            )}
            <Link
              to="/partners"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Partners
            </Link>
            {user ? (
              <Link
                to="/home"
                className="inline-flex items-center rounded-full bg-[#8b5cf6] py-2 pl-3 pr-4 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
              >
                <Plus className="size-4 mr-1.5 shrink-0" strokeWidth={2.5} />
                Open Studio
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex items-center rounded-full bg-[#8b5cf6] py-2 pl-3 pr-4 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
                >
                  <Plus className="size-4 mr-1.5 shrink-0" strokeWidth={2.5} />
                  Start creating
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <header className="relative -mt-14 flex min-h-screen flex-col justify-end overflow-hidden pb-20 px-5">
        {/* Slideshow */}
        <div className="absolute inset-0 z-0">
          {HERO_SLIDES.map((slide, i) => (
            <img
              key={slide.src}
              src={slide.src}
              alt=""
              aria-hidden="true"
              width={1200}
              height={1600}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                i === slideIdx ? "opacity-100" : "opacity-0"
              }`}
              fetchPriority={i === 0 ? "high" : "low"}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-transparent" />
        </div>

        {/* Text content — transitions with each slide */}
        <div className="relative z-10 max-w-sm">
          {HERO_SLIDES.map((slide, i) => (
            <div
              key={slide.src}
              className={`transition-opacity duration-700 ${
                i === slideIdx ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"
              }`}
            >
              <p className="mb-2 flex items-center gap-2 font-sans text-sm font-bold uppercase tracking-[0.18em] text-amber-300">
                <span className="inline-block size-1.5 rounded-full bg-[#8b5cf6]" />
                <EditableCopy copyKey={`landing_hero_${i}_eyebrow`} fallback={slide.eyebrow} />
                {"badge" in slide && slide.badge && (
                  <span className="ml-1 inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 not-italic">
                    <EditableCopy copyKey={`landing_hero_${i}_badge`} fallback={slide.badge} />
                  </span>
                )}
              </p>
              <h1 className="text-[2.9rem] font-semibold leading-[0.93] tracking-tight text-white">
                <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">
                  <EditableCopy copyKey={`landing_hero_${i}_headline`} fallback={slide.headline} />
                </span>
              </h1>
              <p className="mt-5 text-base leading-relaxed text-zinc-200">
                <EditableCopy copyKey={`landing_hero_${i}_sub`} fallback={slide.sub} />
              </p>
              <Link
                to={user ? slide.ctaTo : "/auth"}
                search={user ? undefined : { next: slide.ctaTo }}
                className="mt-6 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-[#8b5cf6] hover:text-white transition-colors"
              >
                <EditableCopy copyKey={`landing_hero_${i}_cta`} fallback={slide.cta} />
              </Link>
            </div>
          ))}
          <div className="mt-8 flex flex-col gap-3">
            <Link
              to={ctaTo}
              className="inline-flex w-fit items-center rounded-full bg-[#8b5cf6] py-3.5 pl-5 pr-6 text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(139,92,246,0.7)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Plus className="size-4 mr-2 shrink-0" strokeWidth={2.5} />
              {user ? "Open Studio" : "Start creating"}
            </Link>
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">
              Free to start · no card needed
            </span>
          </div>
        </div>

        {/* Carousel dot indicators */}
        <div className="absolute bottom-8 right-5 z-10 flex items-center gap-1.5">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setSlideIdx(i)}
              className={`rounded-full transition-all duration-300 ${
                i === slideIdx
                  ? "w-7 h-2 bg-white"
                  : "size-2 bg-white/35 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </header>

      {/* ── Category Strip ──────────────────────────────────────────────── */}
      <div className="border-y border-white/8 bg-zinc-950">
        <div className="flex items-center justify-center gap-4 py-4 px-5 overflow-x-auto">
          {[
            { label: "MUSIC VIDEO STILLS", to: "/music-video" },
            { label: "TOUR POSTERS", to: "/studio" },
            { label: "PRESS PHOTOS", to: "/studio" },
          ].map((item, i, arr) => (
            <div key={item.label} className="flex items-center gap-4 shrink-0">
              <Link
                to={item.to}
                className="text-[10px] font-bold tracking-[0.22em] text-zinc-500 hover:text-zinc-200 transition-colors uppercase no-underline"
              >
                {item.label}
              </Link>
              {i < arr.length - 1 && (
                <span className="text-[#8b5cf6] text-sm font-bold">+</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Ticker ──────────────────────────────────────────────────────── */}
      <div className="overflow-hidden border-b border-white/5 bg-zinc-900/40 py-4">
        <div className="flex w-max animate-ticker gap-12 whitespace-nowrap px-6 text-xs font-bold tracking-[0.3em] text-zinc-500 uppercase">
          {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((label, i) => (
            <span key={i} className="flex items-center gap-12">
              <span>{label}</span>
              <span className="text-[#8b5cf6]">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Process ─────────────────────────────────────────────────────── */}
      <section id="process" className="px-5 py-12">
        <div className="mb-7">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
            The studio flow
          </span>
          <h2 className="mt-2 text-3xl font-semibold leading-tight">
            <EditableCopy copyKey="landing_process_heading" fallback="Reference. Direction. Delivered." />
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            <EditableCopy copyKey="landing_process_sub" fallback="Three steps between the sound in your head and the visual on your feed." />
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <ProcessCard
            step="01"
            label="Reference"
            title="Drop inspiration"
            body="A film scan, a moodboard, or a rough sketch. Aurora reads lighting, texture, and intent — not just objects."
            image="/landing/step-reference.jpg"
            alt="Polaroid moodboard reference"
          />
          <ProcessCard
            step="02"
            label="Direction"
            title="Direct the shoot"
            body="Write like a director. Wardrobe, camera angle, mood, grain. Iterate in plain language until it feels like you."
            custom={<PromptMock />}
          />
          <ProcessCard
            step="03"
            label="Generate"
            title="Ship visuals"
            body="Studio-grade output ready for Spotify, Apple Music, DSP tiles, tour billboards, and everything in between."
            image="/landing/step-final.jpg"
            alt="Final rendered artist portrait"
          />
        </div>
      </section>

      {/* ── Featured Tools ───────────────────────────────────────────────── */}
      <section id="services" className="border-t border-white/5 px-5 py-12">
        <div className="mb-7">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
            Every tool
          </span>
          <h2 className="mt-2 text-3xl font-semibold leading-tight">
            <EditableCopy copyKey="landing_tools_heading" fallback="The full studio." />
            <br />
            <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">
              <EditableCopy copyKey="landing_tools_subheading" fallback="Pay only for what you make." />
            </span>
          </h2>
          <p className="mt-2 max-w-[48ch] text-xs leading-relaxed text-zinc-400">
            <EditableCopy copyKey="landing_tools_blurb" fallback="Every feature is credit based. No subscriptions required to start. 5 free Aura on signup." />
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_TOOLS.map((tool) => (
            <FeaturedToolRow key={tool.label} tool={tool} />
          ))}
        </div>
        <div className="mt-5 text-center">
          <Link
            to="/tools"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-200 transition-colors no-underline"
          >
            See all tools <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>


      {/* ── Viral Engine ─────────────────────────────────────────────── */}
      <ViralEngine />

      {/* ── Every Face Sings (lip-sync demo) ─────────────────────────── */}
      <BalloonLipsync />

      {/* ── Gallery ─────────────────────────────────────────────────────── */}
      <section id="gallery" className="bg-zinc-900/30 py-20 border-y border-white/5 overflow-hidden">
        <div className="px-5 mb-10">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
            Output gallery
          </span>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            <EditableCopy copyKey="landing_gallery_heading" fallback="Real artists. Real outputs. Zero stock." />
          </h2>
          <p className="mt-3 text-sm text-zinc-400">
            <EditableCopy copyKey="landing_gallery_sub" fallback="A curated feed of recent generations across covers, promo, and motion." />
          </p>
        </div>
        {/* Row 1 — scrolls left */}
        <GalleryRow
          items={[
            { src: "/josh-ref-1.png",         alt: "NBA Josh — artist promo",   tag: <EditableCopy copyKey="landing_marquee_r1_1_tag" fallback="Promo"     /> },
            { src: "/landing-client-2.png",   alt: "Editorial shoot",           tag: <EditableCopy copyKey="landing_marquee_r1_2_tag" fallback="Editorial" /> },
            { src: "/landing-client-4.png",   alt: "Backstage promo",           tag: <EditableCopy copyKey="landing_marquee_r1_3_tag" fallback="Promo"     /> },
            { src: "/landing-photo-3.jpeg",   alt: "Album artwork",             tag: <EditableCopy copyKey="landing_marquee_r1_4_tag" fallback="Cover art" /> },
          ]}
          direction="left"
          duration={38}
          className="mb-3"
        />
        {/* Row 2 — scrolls right */}
        <GalleryRow
          items={[
            { src: "/landing-client-5.png",   alt: "Concert energy",              tag: <EditableCopy copyKey="landing_marquee_r2_1_tag" fallback="Concert"   /> },
            { src: "/josh-scene-still.jpeg",  alt: "NBA Josh — scene still",      tag: <EditableCopy copyKey="landing_marquee_r2_2_tag" fallback="Cinema"    /> },
            { src: "/landing-client-7.png",   alt: "Editorial glam",              tag: <EditableCopy copyKey="landing_marquee_r2_3_tag" fallback="Glam"      /> },
            { src: "/landing-photo-5.jpeg",   alt: "Cinematic scene",             tag: <EditableCopy copyKey="landing_marquee_r2_4_tag" fallback="Cinema"    /> },
            { src: "/landing-photo-6.png",    alt: "Color grade",                 tag: <EditableCopy copyKey="landing_marquee_r2_5_tag" fallback="Color"     /> },
          ]}
          direction="right"
          duration={30}
        />
      </section>

      {/* ── Video Reel ──────────────────────────────────────────────────── */}
      <section className="py-20 px-5">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
              Motion generation
            </span>
            <h2 className="mt-3 text-3xl font-semibold leading-tight">
              From still to <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">cinema</span>.
            </h2>
          </div>
          <Link
            to="/music-video"
            className="inline-flex items-center gap-1 text-sm font-medium text-zinc-400 hover:text-zinc-100 shrink-0 transition-colors"
          >
            See more <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/5">
          {/* Poster image paints instantly while the video buffers */}
          <img
            src="/videos/landing-demo-reel-poster.jpg"
            alt="Cinematic Aurora-generated music video frame"
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden
          />
          <video
            src="/videos/landing-demo-reel.mp4"
            poster="/videos/landing-demo-reel-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="aspect-video w-full object-cover relative"
            aria-label="Aurora-generated cinematic music video — artist in a neon rain scene"
          />
          {/* Subtle gradient + CTA at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/80">
              Reel 001 · Motion v1
            </span>
            <Link
              to={ctaTo}
              onClick={() => void track("hero_video_cta_click")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/25 text-white no-underline hover:bg-white/25 transition-colors"
            >
              <Sparkles className="size-3" /> Create yours
            </Link>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/studio"
              onClick={() => void track("hero_start_click")}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full text-white no-underline bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)] hover:brightness-110"
            >
              <Sparkles className="size-4" /> Start creating free
            </Link>
            <Link
              to="/templates"
              onClick={() => void track("hero_templates_click")}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full no-underline aurora-glass-strong text-foreground hover:brightness-110"
            >
              <Wand2 className="size-4" /> Try a template
            </Link>
            <button
              type="button"
              onClick={() => setDemoOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-full bg-white/5 border border-white/10 text-white/80 hover:text-white hover:border-white/20 transition-colors"
            >
              <Play className="size-3.5 fill-current" /> See it in action
            </button>
          </div>
        </div>
      </section>

      {/* ── Social Proof / Testimonials ──────────────────────────────────── */}
      <section className="border-y border-white/5 px-5 py-12">
        <div className="mb-7">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
            30-day transformation
          </span>
          <h2 className="mt-2 text-3xl font-semibold leading-tight">
            Make the next release feel{" "}
            <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">impossible to ignore.</span>
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            { quote: "“I can test three visual directions before I book a single shoot. That changes every release meeting.”", role: "Independent artist · Visual rollout" },
            { quote: "“The moodboard finally became a real world I could send to my team — not another folder of references.”", role: "Creative director · Music & culture" },
            { quote: "“I made a week of release assets in one night, then spent the rest of it making the music better.”", role: "Recording artist · Campaign launch" },
          ].map((testimonial) => (
            <figure key={testimonial.role} className="rounded-2xl border border-white/8 bg-zinc-900/70 p-5">
              <div className="mb-4 flex items-center gap-1 text-[#8b5cf6]" aria-label="Five star review">★★★★★</div>
              <blockquote className="font-serif text-base leading-snug text-zinc-100">{testimonial.quote}</blockquote>
              <figcaption className="mt-5 border-t border-white/8 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{testimonial.role}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── Complete Artist ──────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-b border-white/5">
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
          The director&apos;s chair
        </span>
        <h2 className="mt-3 text-4xl font-semibold leading-tight mb-5">
          Most musicians never get to
          <br />
          <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">direct their own music video.</span>
        </h2>
        <p className="text-zinc-400 text-base leading-relaxed max-w-[38ch] mb-8">
          With Aurora they step into the director&apos;s chair, choose Hollywood-grade cinematic looks, and shape unlimited endings. Because artists deserve the ending they want.
        </p>
        <Link
          to={ctaTo}
          className="inline-flex items-center gap-2 rounded-full bg-white/8 ring-1 ring-white/15 px-5 py-3 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/12 no-underline"
        >
          <Play className="size-4 fill-current" />
          Start directing
        </Link>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="relative border-t border-white/5 px-5 py-20 overflow-hidden">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,oklch(0.35_0.15_295/0.18)_0%,transparent_70%)]" />

        <div className="relative">
          {/* Hook */}
          <div className="mb-14 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">Pricing</span>
            <h2 className="mt-4 text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              A $50,000 shoot.<br />
              <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans text-transparent">For $25 a month.</span>
            </h2>
            <p className="mt-5 max-w-[38ch] mx-auto text-base md:text-lg text-zinc-400 leading-relaxed">
              No crew. No studio. No waiting weeks for edits. Aurora delivers cinematic content in seconds — start free, upgrade when you're ready.
            </p>
            <Link
              to={ctaTo}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#8b5cf6] px-8 py-4 text-base font-bold text-white shadow-[0_8px_32px_-4px_rgba(139,92,246,0.55)] transition-transform hover:scale-105 active:scale-95 no-underline"
            >
              Start free — no card needed
              <ArrowUpRight className="size-5" />
            </Link>
            <p className="mt-3 text-xs text-zinc-600">5 Aura on signup · cancel any time</p>
          </div>

          {/* Subscription tiers */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
            {/* Free */}
            <div className="rounded-2xl bg-zinc-900 ring-1 ring-white/8 p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500 mb-1">Free</p>
                  <p className="text-4xl font-extrabold text-zinc-100">$0</p>
                  <p className="text-sm text-zinc-500 mt-1">5 Aura on signup — try every tool</p>
                </div>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                  <Zap className="size-5 text-zinc-400" />
                </span>
              </div>
              <ul className="flex flex-col gap-2.5 mb-7">
                {[
                  "Image generation (all styles)",
                  "Aurora watermark on video exports",
                  "5 Aura to try every tool",
                  "Permanent gallery",
                  "Standard queue priority",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-400">
                    <Check className="size-4 shrink-0 mt-0.5 text-zinc-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={ctaTo}
                className="block w-full rounded-xl bg-white/8 py-3.5 text-center text-sm font-bold text-zinc-200 ring-1 ring-white/10 transition-colors hover:bg-white/12 no-underline"
              >
                {user ? "You're on Free" : "Start free →"}
              </Link>
            </div>

            {/* Creator */}
            <div className="rounded-2xl bg-zinc-900 ring-1 ring-white/15 p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400 mb-1">Creator</p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-4xl font-extrabold text-zinc-100">$25</p>
                    <p className="text-sm text-zinc-500">/ month</p>
                  </div>
                  <p className="text-sm text-zinc-500 mt-1">1,000 Aura included monthly</p>
                </div>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/8 ring-1 ring-white/15">
                  <Sparkles className="size-5 text-zinc-300" />
                </span>
              </div>
              <ul className="flex flex-col gap-2.5 mb-7">
                {[
                  "1,000 Aura / month included",
                  "No watermark — clean exports",
                  "Full video access (all models)",
                  "Standard queue priority",
                  "All 14 generation tools",
                  "Permanent gallery + Canvas",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="size-4 shrink-0 mt-0.5 text-zinc-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={user ? "/billing" : ctaTo}
                className="block w-full rounded-xl bg-white/10 py-3.5 text-center text-sm font-bold text-zinc-100 ring-1 ring-white/20 transition-colors hover:bg-white/15 no-underline"
              >
                {user ? "Upgrade to Creator" : "Get Creator — $25 / mo →"}
              </Link>
            </div>

            {/* Pro */}
            <div className="relative rounded-2xl bg-zinc-900 ring-2 ring-[#8b5cf6]/70 p-6 shadow-[0_0_60px_-10px_rgba(139,92,246,0.4)]">
              <div className="absolute -top-3.5 left-5">
                <span className="rounded-full bg-[#8b5cf6] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-[0_4px_14px_-2px_rgba(139,92,246,0.6)]">
                  Most popular
                </span>
              </div>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#8b5cf6] mb-1">Pro</p>
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-4xl font-extrabold text-zinc-100">$79</p>
                    <p className="text-sm text-zinc-500">/ month</p>
                  </div>
                  <p className="text-sm text-zinc-500 mt-1">5,000 Aura included monthly</p>
                </div>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#8b5cf6]/15 ring-1 ring-[#8b5cf6]/30">
                  <Crown className="size-5 text-[#8b5cf6]" />
                </span>
              </div>
              <ul className="flex flex-col gap-2.5 mb-7">
                {[
                  "5,000 Aura / month included",
                  "Priority rendering — fastest queue",
                  "Highest-quality models unlocked",
                  "Full commercial use rights",
                  "Everything in Creator",
                  "Growth Tools — daily posts & rollout plans",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <Check className="size-4 shrink-0 mt-0.5 text-[#8b5cf6]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={user ? "/billing" : ctaTo}
                className="block w-full rounded-xl bg-[#8b5cf6] py-3.5 text-center text-sm font-bold text-white shadow-[0_6px_24px_-4px_rgba(139,92,246,0.6)] transition-transform hover:scale-[1.02] active:scale-[0.98] no-underline"
              >
                {user ? "Upgrade to Pro" : "Get Pro — $79 / mo →"}
              </Link>
            </div>
          </div>

          {/* Credit packs */}
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500 mb-4">
              Top-up credit packs · Buy any time, no subscription needed
            </p>
            <div className="flex flex-col gap-2.5">
              {([
                { label: "Starter",  aura: 800,  usd: "$10",  per: "$0.013 / Aura", popular: false },
                { label: "Creator",  aura: 2400, usd: "$30",  per: "$0.013 / Aura", popular: true },
                { label: "Studio",   aura: 6400, usd: "$80",  per: "$0.013 / Aura", popular: false },
              ]).map((p) => (
                <Link
                  key={p.label}
                  to={user ? "/billing" : ctaTo}
                  className={`group flex items-center justify-between rounded-xl px-5 py-4 ring-1 transition-all no-underline ${p.popular ? "bg-zinc-800 ring-white/15 hover:ring-[#8b5cf6]/50" : "bg-zinc-900 ring-white/8 hover:ring-white/15"}`}
                >
                  <div className="flex items-center gap-3">
                    {p.popular && (
                      <span className="rounded-full bg-[#8b5cf6]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#8b5cf6]">
                        Best value
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{p.label} Pack</p>
                      <p className="text-[11px] text-zinc-500">{p.aura} Aura · {p.per}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-zinc-100">{p.usd}</span>
                    <ArrowUpRight className="size-4 text-zinc-600 transition-colors group-hover:text-[#8b5cf6]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <p className="text-center text-[11px] text-zinc-600 leading-relaxed mb-14">
            Just trying it out?{" "}
            <Link to={user ? "/billing" : ctaTo} className="text-zinc-400 hover:text-[#8b5cf6] underline underline-offset-2 transition-colors">
              Day passes from $2
            </Link>
            {" "}· 150 Aura · no commitment.
          </p>

          {/* Closing CTA block */}
          <div className="rounded-3xl bg-gradient-to-br from-[#8b5cf6]/20 via-zinc-900 to-zinc-900 ring-1 ring-[#8b5cf6]/30 p-10 md:p-14 text-center shadow-[0_0_80px_-20px_rgba(139,92,246,0.35)]">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6] mb-4">Start today</p>
            <h3 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4">
              Your next release deserves<br />
              <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans text-transparent">a $50K visual.</span>
            </h3>
            <p className="text-zinc-400 text-base md:text-lg max-w-[36ch] mx-auto mb-8 leading-relaxed">
              Thousands of artists are already creating cinematic content in seconds. You're one click away.
            </p>
            <Link
              to={ctaTo}
              className="inline-flex items-center gap-2.5 rounded-full bg-[#8b5cf6] px-10 py-5 text-lg font-extrabold text-white shadow-[0_12px_40px_-6px_rgba(139,92,246,0.65)] transition-transform hover:scale-105 active:scale-95 no-underline"
            >
              {user ? "Open Studio →" : "Create your first shot — free"}
              <ArrowUpRight className="size-5" />
            </Link>
            <p className="mt-4 text-xs text-zinc-600">No credit card · 5 free Aura · cancel any time</p>
          </div>
        </div>
      </section>

      {/* ── Aurora Partners ─────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/5">
        <div className="mb-8">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
            Aurora Partners
          </span>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            Earn while you{" "}
            <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">grow the movement.</span>
          </h2>
          <p className="mt-3 text-sm text-zinc-400 max-w-[38ch] leading-relaxed">
            Bring artists into Aurora and earn recurring revenue for every creator who signs up through your link.
          </p>
        </div>
        <ul className="flex flex-col gap-3 mb-8">
          {[
            "Recurring revenue for every active creator you refer",
            "Exclusive partner dashboard with real-time stats",
            "Co-marketing with Aurora — grow your brand alongside ours",
          ].map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm text-zinc-300">
              <Check className="size-4 shrink-0 mt-0.5 text-[#8b5cf6]" />
              {b}
            </li>
          ))}
        </ul>
        <Link
          to="/partners"
          className="inline-flex items-center gap-2 rounded-full bg-[#8b5cf6] px-6 py-3 text-sm font-semibold text-white shadow-[0_6px_20px_-4px_rgba(139,92,246,0.5)] transition-transform hover:scale-[1.02] active:scale-95 no-underline"
        >
          Become a Partner
          <ArrowUpRight className="size-4" />
        </Link>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 px-5">
        <div className="mb-10 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
            Questions
          </span>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">
            Answered <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">honestly.</span>
          </h2>
        </div>
        <div className="divide-y divide-white/5 border-y border-white/5">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 pt-14 pb-8 px-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-block size-2 rounded-full bg-[#8b5cf6]" />
          <span className="text-sm font-bold tracking-[0.15em] uppercase text-zinc-100">Aurora</span>
        </div>
        <p className="text-sm text-zinc-500 mb-10">
          Built by pro artists, for artists scaling massively. The performance studio for
          the algorithmic age.
        </p>
        <div className="grid grid-cols-3 gap-6 mb-10">
          <FooterCol
            title="Product"
            links={[
              { label: "Studio", to: "/studio" },
              { label: "Canvas", to: "/canvas" },
              { label: "Video", to: "/music-video" },
              { label: "Pricing", to: "/billing" },
              { label: "Partners", to: "/partners" },
            ]}
          />
          <FooterCol
            title="Create"
            links={[
              { label: "Motion", to: "/motion" },
              { label: "Colors", to: "/colors" },
              { label: "Gallery", to: "/gallery" },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { label: "Privacy", to: "/" },
              { label: "Terms", to: "/" },
            ]}
          />
        </div>
        <div className="border-t border-white/5 pt-6 text-xs text-zinc-600">
          © {new Date().getFullYear()} Aurora Performance Studio. Built by pro artists, for artists who scale.
        </div>
      </footer>

      <AdminLandingEditor />
      <div className="h-24" aria-hidden />
    </div>
  );
}

function FeaturedToolRow({ tool }: { tool: typeof FEATURED_TOOLS[number] }) {
  const Icon = tool.icon;
  return (
    <Link
      to={tool.to}
      className="group relative min-h-40 overflow-hidden rounded-2xl border border-white/8 bg-zinc-900/75 p-4 no-underline transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-zinc-900"
    >
      <span className="absolute -right-7 -top-7 size-28 rounded-full bg-[#8b5cf6]/10 blur-2xl transition-opacity group-hover:opacity-100" />
      <div className="relative flex h-full flex-col">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/6 ring-1 ring-white/10">
          <Icon className="size-4 text-zinc-200" />
        </span>
        <div className="mt-auto pt-6">
          <p className="text-sm font-semibold leading-tight text-zinc-100">{tool.label}</p>
          <p className="mt-1 text-[11px] leading-snug text-zinc-500">{tool.desc}</p>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/7 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b5cf6]">{tool.price}</span>
          <ArrowUpRight className="size-3.5 text-zinc-600 transition-colors group-hover:text-zinc-200" />
        </div>
      </div>
    </Link>
  );
}


function ProcessCard({
  step,
  label,
  title,
  body,
  image,
  alt,
  custom,
}: {
  step: string;
  label: string;
  title: string;
  body: string;
  image?: string;
  alt?: string;
  custom?: React.ReactNode;
}) {
  return (
    <div className="group">
      <div className="mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/5">
        {image ? (
          <img
            src={image}
            alt={alt ?? ""}
            width={800}
            height={600}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        ) : (
          custom
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-bold text-[#8b5cf6] uppercase tracking-[0.25em]">{step}</span>
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{label}</span>
      </div>
      <h3 className="mt-1.5 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{body}</p>
    </div>
  );
}

function PromptMock() {
  return (
    <div className="flex w-full max-w-xs flex-col gap-3 p-6">
      <div className="rounded-lg bg-zinc-800/80 px-3 py-2 text-[11px] text-zinc-300 ring-1 ring-white/10">
        Vivid crimson studio lighting, 35mm grain…
      </div>
      <div className="rounded-lg bg-zinc-800/80 px-3 py-2 text-[11px] text-zinc-300 ring-1 ring-white/10 w-4/5">
        Editorial fashion styling, deep shadow
      </div>
      <div className="rounded-lg bg-[#8b5cf6]/15 px-3 py-2 text-[11px] text-[#8b5cf6] ring-1 ring-[#8b5cf6]/50 w-3/5 flex items-center gap-2">
        <span className="inline-block size-1.5 rounded-full bg-[#8b5cf6] animate-pulse" />
        Directing shoot…
      </div>
      <div className="mt-2 rounded-lg bg-zinc-900 px-3 py-2 text-[10px] text-zinc-500 ring-1 ring-white/5">
        Aurora · v1.2 · 4K
      </div>
    </div>
  );
}

type GalleryItem = { src: string; alt: string; tag: ReactNode };

function MarqueePhoto({ src, alt, tag }: GalleryItem) {
  return (
    <div className="group relative h-52 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/5">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-auto max-w-none object-cover transition-transform duration-700 group-hover:scale-[1.04]"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 to-transparent px-3 py-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-white">{tag}</span>
        <span className="text-[9px] uppercase tracking-widest text-white/50">Aurora</span>
      </div>
    </div>
  );
}

function GalleryRow({
  items,
  direction,
  duration,
  className = "",
}: {
  items: GalleryItem[];
  direction: "left" | "right";
  duration: number;
  className?: string;
}) {
  const animName = direction === "left" ? "gallery-scroll-left" : "gallery-scroll-right";
  const doubled = [...items, ...items];
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div
        className="flex gap-3"
        style={{ width: "max-content", animation: `${animName} ${duration}s linear infinite` }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.animationPlayState = "paused")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.animationPlayState = "running")}
      >
        {doubled.map((item, i) => (
          <MarqueePhoto key={`${direction}-${i}`} src={item.src} alt={item.alt} tag={item.tag} />
        ))}
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between gap-4 text-left text-sm font-semibold uppercase tracking-widest text-zinc-100"
      >
        <span>{q}</span>
        <ChevronDown
          className={`size-4 shrink-0 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      {open && (
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{a}</p>
      )}
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; to: string }[];
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs font-bold uppercase tracking-widest text-zinc-100">{title}</span>
      {links.map((l) => (
        <Link
          key={l.label}
          to={l.to}
          className="text-sm text-zinc-500 hover:text-[#8b5cf6] transition-colors"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
