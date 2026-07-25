import { createFileRoute, Link } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import { Plus, Play, ArrowUpRight, ChevronDown, Sparkles, Palette, Film, Wand2, Mic, Music2, Brush, Megaphone, UserCircle2, Workflow, Layers, Flame, Bot, Clapperboard, Check, Zap, Crown, Download } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect, useRef } from "react";
import { ViralEngine } from "@/components/landing/ViralEngine";
import { BalloonLipsync } from "@/components/landing/BalloonLipsync";
import { AdminLandingEditor } from "@/components/AdminLandingEditor";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aurora — AI Creative Studio for Artists & Performers" },
      { name: "description", content: "Turn one photo into magazine-grade performance shots, music-video stills, lip-sync videos and UGC ads — in seconds. Built by pro artists, for artists who need to scale massively." },
      { property: "og:title", content: "Aurora — AI Creative Studio for Artists & Performers" },
      { property: "og:description", content: "Turn one photo into magazine-grade performance shots, music-video stills, lip-sync videos and UGC ads — in seconds. Built by pro artists, for artists who need to scale massively." },
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
                text: "You do. Every generation on Aurora is 100% owned by the artist who created it. Full commercial rights are included from your very first click.",
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
                text: "Yes. Pro and Studio tiers include 4K stills and 4K/60fps motion exports for music-video backgrounds, tour visuals, and DSP canvas loops.",
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
  "/hero/hero-1.png",
  "/hero/hero-2.png",
  "/hero/hero-3.png",
  "/hero/hero-4.png",
  "/hero/hero-5.png",
  "/hero/hero-6.png",
  "/hero/hero-7.png",
  "/hero/hero-8.png",
  "/hero/hero-9.png",
];

const FEATURED_TOOLS = [
  {
    label: "Motion Control",
    desc: "Transfer your real 30-second performance into any AI scene.",
    to: "/motion",
    icon: Wand2,
    price: "From 30 Aura",
  },
  {
    label: "Perform Anywhere",
    desc: "Selfie + outfit + scene → cinematic performance video, anywhere.",
    to: "/perform",
    icon: Film,
    price: "From 20 Aura",
  },
  {
    label: "Colors Performance Sessions",
    desc: "Direct your palette across cyc, indoor and rooftop performance sets.",
    to: "/colors",
    icon: Palette,
    price: "From 10 Aura",
  },
  {
    label: "Video Agent",
    desc: "AI creative director, chat a shot, get a rendered video back.",
    to: "/agent",
    icon: Bot,
    price: "From 8 Aura",
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
];


const TICKER_ITEMS = [
  "Album covers",
  "Music video stills",
  "Tour posters",
  "Press photos",
  "Spotify Canvas",
  "Social assets",
  "Concert reels",
];

const FAQS = [
  {
    q: "Who owns the rights to what I generate?",
    a: "You do. Every generation on Aurora is 100% owned by the artist who created it. Full commercial rights are included from your very first click.",
  },
  {
    q: "Is Aurora training on my uploads?",
    a: "No. Aurora runs a closed-loop model. Your references and prompts are never used for training unless you explicitly opt in to a private model for your project.",
  },
  {
    q: "Can I export 4K stills and video?",
    a: "Yes. Pro and Studio tiers include 4K stills and 4K/60fps motion exports for music-video backgrounds, tour visuals, and DSP canvas loops.",
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
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
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
  const ctaTo = user ? "/studio" : "/auth";
  const { canInstall, install } = usePwaInstall();

  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % HERO_SLIDES.length), 4500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-display antialiased selection:bg-[#e5383b] selection:text-white">

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
            {user ? (
              <Link
                to="/studio"
                className="inline-flex items-center rounded-full bg-[#e5383b] py-2 pl-3 pr-4 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
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
                  className="inline-flex items-center rounded-full bg-[#e5383b] py-2 pl-3 pr-4 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
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
          {HERO_SLIDES.map((src, i) => (
            <img
              key={src}
              src={src}
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

        {/* Text content */}
        <div className="relative z-10 max-w-sm">
          <p className="mb-3 flex items-center gap-2 font-serif italic text-amber-400 text-sm">
            <span className="inline-block size-1.5 rounded-full bg-[#e5383b]" />
            By Artists, for Artists
          </p>
          <h1 className="text-[3.2rem] font-semibold leading-[0.92] tracking-tight text-white">
            Direct your
            <br />
            <span className="font-serif italic">visual identity.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-zinc-200">
            The AI performance studio built by artists, for artists. Drop your references, direct the shoot in plain language, and ship studio grade covers, promo, and cinematic performance reels in seconds, not weeks.
          </p>
          <div className="mt-8 flex flex-col gap-3">
            <Link
              to={ctaTo}
              className="inline-flex w-fit items-center rounded-full bg-[#e5383b] py-3.5 pl-5 pr-6 text-base font-semibold text-white shadow-[0_10px_40px_-10px_rgba(229,56,59,0.7)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Plus className="size-4 mr-2 shrink-0" strokeWidth={2.5} />
              {user ? "Open Studio" : "Start creating"}
            </Link>
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-500">
              Credit card accepted · 5 free credits on signup
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
                <span className="text-[#e5383b] text-sm font-bold">+</span>
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
              <span className="text-[#e5383b]">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Process ─────────────────────────────────────────────────────── */}
      <section id="process" className="py-20 px-5">
        <div className="mb-12">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#e5383b]">
            The studio flow
          </span>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            Reference. Direction.{" "}
            <span className="font-serif italic">Delivered.</span>
          </h2>
          <p className="mt-3 text-zinc-400 text-sm leading-relaxed">
            Three steps between the sound in your head and the visual on your feed.
          </p>
        </div>

        <div className="flex flex-col gap-12">
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
      <section id="services" className="py-20 px-5 border-t border-white/5">
        <div className="mb-10">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#e5383b]">
            Every tool
          </span>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            The full studio.
            <br />
            <span className="font-serif italic">Pay only for what you make.</span>
          </h2>
          <p className="mt-3 text-sm text-zinc-400 max-w-[40ch] leading-relaxed">
            Every feature is credit based. No subscriptions required to start. 5 free Aura on signup.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {FEATURED_TOOLS.map((tool) => (
            <FeaturedToolCard key={tool.label} tool={tool} />
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link
            to="/studio"
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
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#e5383b]">
            Output gallery
          </span>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            Real artists. Real outputs.{" "}
            <span className="font-serif italic">Zero stock.</span>
          </h2>
          <p className="mt-3 text-sm text-zinc-400">
            A curated feed of recent generations across covers, promo, and motion.
          </p>
        </div>
        {/* Row 1 — scrolls left */}
        <GalleryRow
          items={[
            { src: "/josh-ref-1.png",         alt: "NBA Josh — artist promo",   tag: "Promo"     },
            { src: "/landing-client-2.png",   alt: "Editorial shoot",           tag: "Editorial" },
            { src: "/josh-ref-2.jpeg",        alt: "NBA Josh — studio session", tag: "Artist"    },
            { src: "/landing-client-4.png",   alt: "Backstage promo",           tag: "Promo"     },
            { src: "/josh-ref-3.jpeg",        alt: "NBA Josh — lifestyle",      tag: "Lifestyle" },
            { src: "/landing-photo-3.jpeg",   alt: "Album artwork",             tag: "Cover art" },
          ]}
          direction="left"
          duration={38}
          className="mb-3"
        />
        {/* Row 2 — scrolls right */}
        <GalleryRow
          items={[
            { src: "/landing-client-5.png",   alt: "Concert energy",              tag: "Concert"   },
            { src: "/josh-scene-still.jpeg",  alt: "NBA Josh — scene still",      tag: "Cinema"    },
            { src: "/landing-client-7.png",   alt: "Editorial glam",              tag: "Glam"      },
            { src: "/josh-officers-bg.webp",  alt: "Looping Officers — scene",    tag: "Video"     },
            { src: "/landing-photo-5.jpeg",   alt: "Cinematic scene",             tag: "Cinema"    },
            { src: "/landing-photo-6.png",    alt: "Color grade",                 tag: "Color"     },
          ]}
          direction="right"
          duration={30}
        />
      </section>

      {/* ── Video Reel ──────────────────────────────────────────────────── */}
      <section className="py-20 px-5">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#e5383b]">
              Motion generation
            </span>
            <h2 className="mt-3 text-3xl font-semibold leading-tight">
              From still to <span className="font-serif italic">cinema</span>.
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
          <img
            src="/landing/reel-poster.jpg"
            alt="Cinematic music video still — artist walking through neon rain"
            width={1920}
            height={1080}
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Link
              to={ctaTo}
              aria-label="Start creating videos"
              className="flex size-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/30 transition-transform hover:scale-105"
            >
              <Play className="size-7 text-white translate-x-0.5" fill="currentColor" />
            </Link>
          </div>
          <div className="absolute bottom-4 left-4 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/80">
            Reel 001 · Motion v1
          </div>
        </div>
      </section>

      {/* ── Testimonial ─────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-y border-white/5">
        <div className="text-center">
          <p className="font-serif text-2xl italic leading-snug text-zinc-200">
            &ldquo;Aurora shifted how we handle visual rollouts. We went from three weeks of
            production to a single afternoon — without losing an ounce of soul.&rdquo;
          </p>
          <div className="mt-8 flex flex-col items-center">
            <div className="size-11 rounded-full bg-gradient-to-br from-[#e5383b] to-zinc-800 ring-1 ring-white/10" />
            <span className="mt-3 text-sm font-semibold uppercase tracking-widest">
              Marcus Vane
            </span>
            <span className="text-xs text-zinc-500">Creative Director · Nocturne Records</span>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-5 border-t border-white/5">
        <div className="mb-10">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#e5383b]">
            Pricing
          </span>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            Simple pricing.<br />
            <span className="font-serif italic">Pay for what you make.</span>
          </h2>
          <p className="mt-3 text-sm text-zinc-400 max-w-[40ch] leading-relaxed">
            Start free. Upgrade when you're ready. All features available on every plan.
          </p>
        </div>

        {/* Subscription tiers */}
        <div className="flex flex-col gap-4 mb-8">
          {/* Free */}
          <div className="rounded-2xl bg-zinc-900 ring-1 ring-white/8 p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500 mb-1">Starter</p>
                <p className="text-3xl font-semibold text-zinc-100">Free</p>
                <p className="text-sm text-zinc-500 mt-1">50 Aura on signup · 200 Aura / month</p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <Zap className="size-5 text-zinc-400" />
              </span>
            </div>
            <ul className="flex flex-col gap-2 mb-6">
              {["All 14 generation tools", "Permanent gallery", "Canvas pipeline editor", "Aurora watermark on exports", "Standard queue priority"].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-400">
                  <Check className="size-4 shrink-0 mt-0.5 text-zinc-600" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to={ctaTo}
              className="block w-full rounded-xl bg-white/8 py-3 text-center text-sm font-semibold text-zinc-200 ring-1 ring-white/10 transition-colors hover:bg-white/12"
            >
              {user ? "You're on Free" : "Start free — no card needed"}
            </Link>
          </div>

          {/* Pro */}
          <div className="relative rounded-2xl bg-zinc-900 ring-2 ring-[#e5383b]/60 p-6 shadow-[0_0_40px_-10px] shadow-red-600/30">
            <div className="absolute -top-3 left-5">
              <span className="rounded-full bg-[#e5383b] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                Most popular
              </span>
            </div>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#e5383b] mb-1">Pro</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-3xl font-semibold text-zinc-100">$15</p>
                  <p className="text-sm text-zinc-500">/ month</p>
                </div>
                <p className="text-sm text-zinc-500 mt-1">2,000 Aura included monthly</p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e5383b]/15 ring-1 ring-[#e5383b]/30">
                <Crown className="size-5 text-[#e5383b]" />
              </span>
            </div>
            <ul className="flex flex-col gap-2 mb-6">
              {[
                "2,000 Aura / month included",
                "No watermark on exports",
                "Priority queue — faster renders",
                "All premium templates unlocked",
                "Growth Tools — daily posts, rollout plans & social packs",
                "All 14 generation tools",
                "Permanent gallery + Canvas",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                  <Check className="size-4 shrink-0 mt-0.5 text-[#e5383b]" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to={user ? "/billing" : ctaTo}
              className="block w-full rounded-xl bg-[#e5383b] py-3 text-center text-sm font-semibold text-white shadow-[0_6px_20px_-4px_rgba(229,56,59,0.5)] transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              {user ? "Upgrade to Pro" : "Get Pro — $15 / month"}
            </Link>
          </div>
        </div>

        {/* Credit packs */}
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500 mb-4">
            Top-up credit packs · Buy any time
          </p>
          <div className="flex flex-col gap-3">
            {([
              { label: "Starter",  aura: 800,  usd: "$10",  per: "$0.013 / Aura", popular: false },
              { label: "Creator",  aura: 2400, usd: "$30",  per: "$0.013 / Aura", popular: true },
              { label: "Studio",   aura: 6400, usd: "$80",  per: "$0.013 / Aura", popular: false },
            ]).map((p) => (
              <Link
                key={p.label}
                to={user ? "/billing" : ctaTo}
                className={`group flex items-center justify-between rounded-xl px-5 py-4 ring-1 transition-all no-underline ${p.popular ? "bg-zinc-800 ring-white/15 hover:ring-[#e5383b]/40" : "bg-zinc-900 ring-white/8 hover:ring-white/15"}`}
              >
                <div className="flex items-center gap-3">
                  {p.popular && (
                    <span className="rounded-full bg-[#e5383b]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#e5383b]">
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
                  <ArrowUpRight className="size-4 text-zinc-600 transition-colors group-hover:text-[#e5383b]" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Day passes note */}
        <p className="text-center text-[11px] text-zinc-600 leading-relaxed">
          Just trying it out?{" "}
          <Link to={user ? "/billing" : ctaTo} className="text-zinc-400 hover:text-[#e5383b] underline underline-offset-2 transition-colors">
            Day passes from $2
          </Link>
          {" "}· 150 Aura · no commitment.
        </p>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 px-5">
        <div className="mb-10 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#e5383b]">
            Questions
          </span>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight">
            Answered <span className="font-serif italic">honestly.</span>
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
          <span className="inline-block size-2 rounded-full bg-[#e5383b]" />
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

function FeaturedToolCard({ tool }: { tool: typeof FEATURED_TOOLS[number] }) {
  const Icon = tool.icon;
  return (
    <Link
      to={tool.to}
      className="group flex flex-col justify-between rounded-2xl bg-zinc-900 ring-1 ring-white/8 p-4 transition-all hover:ring-white/20 no-underline min-h-[180px]"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/6 ring-1 ring-white/10">
          <Icon className="size-4 text-zinc-300" />
        </span>
        <span className="text-[11px] font-bold text-[#e5383b] tabular-nums">
          {tool.price}
        </span>
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-semibold text-zinc-100 leading-tight mb-1.5">
          {tool.label}
        </p>
        <p className="text-[11px] leading-snug text-zinc-500 line-clamp-2">
          {tool.desc}
        </p>
      </div>
      <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 transition-colors group-hover:text-zinc-300">
        Open <ArrowUpRight className="size-3" />
      </span>
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
      <div className="mb-5 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/5">
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
        <span className="text-xs font-bold text-[#e5383b] uppercase tracking-[0.25em]">{step}</span>
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{label}</span>
      </div>
      <h3 className="mt-2 text-xl font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{body}</p>
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
      <div className="rounded-lg bg-[#e5383b]/15 px-3 py-2 text-[11px] text-[#e5383b] ring-1 ring-[#e5383b]/50 w-3/5 flex items-center gap-2">
        <span className="inline-block size-1.5 rounded-full bg-[#e5383b] animate-pulse" />
        Directing shoot…
      </div>
      <div className="mt-2 rounded-lg bg-zinc-900 px-3 py-2 text-[10px] text-zinc-500 ring-1 ring-white/5">
        Aurora · v1.2 · 4K
      </div>
    </div>
  );
}

type GalleryItem = { src: string; alt: string; tag: string };

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
          className="text-sm text-zinc-500 hover:text-[#e5383b] transition-colors"
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}
