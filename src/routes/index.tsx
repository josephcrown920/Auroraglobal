import { createFileRoute, Link } from "@tanstack/react-router";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import { Plus, Play, ArrowUpRight, ChevronDown, Sparkles, Palette, Film, Wand2, Mic, Music2, Brush, Megaphone, UserCircle2, Workflow, Layers, Flame, Clapperboard, Check, Download, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { HiddenBadge, useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { featureKeyForRoute, type FeatureKey } from "@/lib/feature-visibility";
import { lazy, Suspense, useCallback, useState, useEffect, useRef, type ReactNode } from "react";
import { track } from "@/lib/tracking";
import { EditableCopy } from "@/components/EditableCopy";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { DemoMedia } from "@/components/visual/DemoMedia";
import { OutputGallery } from "@/components/visual/OutputGallery";
import { ScrollReveal } from "@/components/visual/ScrollReveal";
import { EditableStaggeredHeadline } from "@/components/visual/EditableStaggeredHeadline";
import { DEMO_ASSETS } from "@/lib/demo-assets";
import { LANDING_IMAGE_SRCSET } from "@/lib/landing-image-manifest";
import { TOOL_DIRECTORY } from "@/lib/tool-directory";
// Motion-reel clip: a real Aurora music-video render (see TikTokSection for
// the rest of the set). Imported as URLs only — no runtime weight.
import reelClip from "@/assets/josh/generated/clip-15-alley-neon.mp4";
import reelPoster from "@/assets/josh/generated/still-15-alley-neon.jpg";
import {
  COST_TIKTOK_REMIX_CUT,
  COST_UGC_AD,
  computeCost,
  lipsyncEngineCost,
  ONBOARDING_BONUS_AURA,
} from "@/lib/pricing";

const PRICE_IMAGE = computeCost({ features: ["image"] }).total;
const PRICE_MOTION = computeCost({ features: ["motion"] }).total;
const PRICE_PERFORMANCE = computeCost({
  features: ["video", "motion"],
  model: "seedance-2.0-fast",
}).total;
const PRICE_VIDEO_AGENT = computeCost({
  features: ["video"],
  model: "heygen/video-agent",
}).total;
const PRICE_AVATAR = lipsyncEngineCost("heygen-photo");

// Below-fold sections — lazy-loaded so the landing page hero ships without
// pulling in framer-motion, spin-engine, server-fn hooks, and media assets.
const ViralEngine = lazy(() =>
  import("@/components/landing/ViralEngine").then((m) => ({ default: m.ViralEngine })),
);
const BalloonLipsync = lazy(() =>
  import("@/components/landing/BalloonLipsync").then((m) => ({ default: m.BalloonLipsync })),
);
const AppScreenshotsSection = lazy(() =>
  import("@/components/landing/AppScreenshotsSection").then((m) => ({ default: m.AppScreenshotsSection })),
);
const CliSection = lazy(() =>
  import("@/components/landing/CliSection").then((m) => ({ default: m.CliSection })),
);

const PhotoStrip = lazy(() =>
  import("@/components/landing/PhotoStrip").then((m) => ({ default: m.PhotoStrip })),
);
const UGCAdsSection = lazy(() =>
  import("@/components/landing/UGCAdsSection").then((m) => ({ default: m.UGCAdsSection })),
);

const ModelSpotlight = lazy(() =>
  import("@/components/landing/ModelSpotlight").then((m) => ({ default: m.ModelSpotlight })),
);
const IntroAnimation = lazy(() =>
  import("@/components/landing/IntroAnimation").then((m) => ({ default: m.IntroAnimation })),
);
const AdminLandingEditor = lazy(() =>
  import("@/components/AdminLandingEditor").then((m) => ({ default: m.AdminLandingEditor })),
);
const PricingSection = lazy(() =>
  import("@/components/landing/PricingSection").then((m) => ({ default: m.PricingSection })),
);
const FinalCTA = lazy(() =>
  import("@/components/landing/FinalCTA").then((m) => ({ default: m.FinalCTA })),
);
const CollaboratorsStrip = lazy(() =>
  import("@/components/landing/CollaboratorsStrip").then((m) => ({ default: m.CollaboratorsStrip })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aurora — Turn Your Phone Recording into a Cinematic Music Video" },
      { name: "description", content: "Create videos that look like a $50,000 production — for a fraction of the cost. Aurora is the AI studio built for music artists and creators. No crew, no studio, no waiting." },
      { property: "og:title", content: "Aurora — Turn Your Phone Recording into a Cinematic Music Video" },
      { property: "og:description", content: "Create videos that look like a $50,000 production — for a fraction of the cost. Aurora is the AI studio built for music artists and creators. No crew, no studio, no waiting." },
      { property: "og:url", content: CANONICAL_ORIGIN },
    ],
    links: [
      { rel: "canonical", href: CANONICAL_ORIGIN },
      // Preload the first hero slide's WebP variants so the LCP image starts
      // downloading before the component tree renders. href is required —
      // TanStack's head serializer drops <link> entries without one — and
      // doubles as the fallback for browsers that ignore imagesrcset.
      {
        rel: "preload",
        as: "image",
        href: "/hero/hero-direct-identity.w928.webp",
        imageSrcSet: LANDING_IMAGE_SRCSET["/hero/hero-direct-identity.png"],
        imageSizes: "100vw",
        fetchPriority: "high",
      },
    ],
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
    src: "/hero/hero-direct-identity.png",
    eyebrow: "By Artists, for Artists",
    headline: "Direct Your Visual Identity.",
    sub: "The AI performance studio built by artists, for artists. Drop your references, direct the shoot in plain language, and ship studio-grade covers, promo, and cinematic performance reels — in seconds, not weeks.",
    cta: "Start creating →",
    ctaTo: "/studio",
    refPrompt: "Studio-grade artist portrait, dramatic red and blue stage lighting, cinematic film grain",
  },
  {
    src: "/hero/hero-perform-anywhere.png",
    eyebrow: "Flagship Feature",
    badge: "★ Pro",
    headline: "Perform Anywhere.",
    sub: "Stop renting studios, hiring crews, and waiting weeks for edits. Record yourself for 30 seconds on your iPhone — Aurora transforms your performance into cinematic music videos and visuals that look like they were directed by a major production team.",
    cta: "Try Perform Anywhere →",
    ctaTo: "/motion",
    refPrompt: "Cinematic performance scene, moody concert lighting, 35mm film still",
  },
  {
    src: "/hero/hero-2.png",
    eyebrow: "TikTok 30",
    badge: "★ Pro",
    headline: "Go Viral On TikTok In 30 Seconds.",
    sub: "Turn one idea into an entire month of scroll-stopping content. Aurora creates 30 unique TikToks, lyric videos, teasers, cover reveals, reels, and promo posts ready to publish.",
    cta: "TikTok 30 →",
    ctaTo: "/spin",
    refPrompt: "Scroll-stopping social promo visual, bold styling, high-contrast color pop",
  },
  {
    src: "/hero/hero-colors.png",
    eyebrow: "Colors Studio",
    badge: "★ Pro",
    headline: "One Performance. Unlimited Visual Worlds.",
    sub: "Record one 30-second performance. Aurora rebuilds it into endless cinematic stages, lighting styles, outfits, moods and color worlds ready for every release.",
    cta: "Explore Colors Studio →",
    ctaTo: "/colors",
    refPrompt: "Colors show performance set, saturated monochrome backdrop, editorial styling",
  },
  {
    src: "/hero/hero-7.png",
    eyebrow: "Press Ready",
    badge: "★ Pro",
    headline: "Look Like The Biggest Artist In Your City.",
    sub: "Create magazine-quality press photos, tour posters, album covers, and promotional visuals in minutes—not weeks.",
    cta: "Create Press Photos →",
    ctaTo: "/music-video",
    refPrompt: "Magazine-quality press photo, editorial lighting, tour poster energy",
  },
];

const FEATURED_TOOLS: ReadonlyArray<{
  label: string;
  desc: string;
  to: string;
  icon: LucideIcon;
  price: string;
  /** Gateable feature backing this tile (artist-only mode hides it). */
  feature?: FeatureKey;
}> = [
  {
    label: "Motion Control",
    desc: "Transfer your real 30-second performance into any AI scene.",
    to: "/motion",
    icon: Wand2,
    price: `From ${PRICE_MOTION} Aura`,
  },
  {
    label: "Perform Anywhere",
    desc: "Phone performance + avatar + outfit + scene → cinematic video, anywhere.",
    to: "/perform",
    icon: Film,
    price: `From ${PRICE_PERFORMANCE} Aura`,
  },
  {
    label: "Aurora Video Agent",
    desc: "Plan, storyboard, edit, and render a complete cinematic video.",
    to: "/video-agent",
    icon: Clapperboard,
    price: `From ${PRICE_VIDEO_AGENT} Aura`,
  },
  {
    label: "Colors Performance Sessions",
    desc: "Direct your palette across cyc, indoor and rooftop performance sets.",
    to: "/colors",
    icon: Palette,
    price: `From ${PRICE_IMAGE} Aura`,
  },
  {
    label: "Get Ready With Me",
    desc: "Outfit swap talking GRWM reels straight from a single selfie.",
    to: "/studio",
    icon: UserCircle2,
    price: `From ${COST_UGC_AD} Aura`,
    feature: "grwm",
  },
  {
    label: "TikTok30 UGC Factory",
    desc: "Create 30 campaign posts, animate any result, or send it to Motion Control.",
    to: "/spin",
    icon: Flame,
    price: `${COST_TIKTOK_REMIX_CUT} Aura`,
    feature: "spin",
  },
  {
    label: "Talking Avatar Studio",
    desc: "Write the script, choose the face and voice, then generate a camera-ready avatar video.",
    to: "/avatar",
    icon: UserCircle2,
    price: `From ${PRICE_AVATAR} Aura`,
    feature: "talking-avatars",
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

const INTRO_SEEN_KEY = "aurora_intro_seen";

function shouldShowIntro() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) !== "1";
  } catch {
    return true;
  }
}

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
  const ctaTo = user ? "/studio" : "/auth";
  const { canInstall, install } = usePwaInstall();
  const { showFeature } = useFeatureVisibility();

  // Artist-only gating: drop hero slides / tool tiles / directory rows whose
  // backing feature is hidden for this viewer (admins keep everything).
  const heroSlides = HERO_SLIDES.filter((s) => showFeature(featureKeyForRoute(s.ctaTo)));
  const featuredTools = FEATURED_TOOLS.filter((t) => showFeature(t.feature ?? featureKeyForRoute(t.to)));
  const toolDirectory = TOOL_DIRECTORY.filter((t) => showFeature(featureKeyForRoute(t.to)));

  const [introVisible, setIntroVisible] = useState(shouldShowIntro);
  const [slideIdx, setSlideIdx] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);
  const slideCount = heroSlides.length;
  useEffect(() => {
    if (introVisible || slideCount === 0) return;
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % slideCount), 5000);
    return () => clearInterval(t);
  }, [introVisible, slideCount]);
  // Keep the index in range when the slide list shrinks after the live
  // visibility state arrives.
  useEffect(() => {
    if (slideCount > 0 && slideIdx >= slideCount) setSlideIdx(0);
  }, [slideCount, slideIdx]);

  useEffect(() => {
    if (!introVisible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [introVisible]);

  const handleIntroDone = useCallback(() => {
    try {
      window.localStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      // The overlay still closes when storage is unavailable.
    }
    setIntroVisible(false);
  }, []);

  return (
    // `relative` makes this page the containing block for the absolute nav
    // below. Without it the nav resolved against whichever ancestor happened
    // to be positioned/transformed (the route-transition wrapper), and a
    // collapsed negative margin on the hero dragged it above the viewport —
    // the landing had no visible logo, Sign in, or Start creating at all.
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 font-display antialiased selection:bg-[#8b5cf6] selection:text-white">
      <Suspense fallback={null}>{introVisible && <IntroAnimation onDone={handleIntroDone} />}</Suspense>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav aria-label="Primary" className="landing-nav absolute inset-x-0 top-0 z-40 w-full">
        <div className="flex h-14 items-center justify-between gap-3 px-5">
          <Link
            to="/"
            aria-label="Aurora Performance Studio — home"
            className="flex min-w-0 shrink items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8b5cf6] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {/* Same cropped mark + tile as the signed-in sidebar, so the brand
                reads identically whether a visitor is logged in or not. */}
            <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0a0a0f] ring-1 ring-white/15 shadow-[0_0_20px_-6px_rgba(139,92,246,0.75)]">
              <img
                src="/brand/aurora-mark.webp"
                alt=""
                width={36}
                height={36}
                decoding="async"
                className="size-full scale-110 object-cover"
              />
            </span>
            <span className="flex min-w-0 flex-col leading-tight drop-shadow-[0_1px_10px_rgba(0,0,0,0.75)]">
              <span className="truncate text-[13px] font-bold tracking-tight text-white">AURORA</span>
              <span className="landing-nav-sub truncate text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                Performance Studio
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            {canInstall && (
              <button
                type="button"
                onClick={install}
                aria-label="Install the Aurora app"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                <Download className="size-3 shrink-0" />
                <span className="landing-nav-install-label">Install</span>
              </button>
            )}
            <Link
              to="/partners"
              className="landing-nav-partners inline-flex min-h-10 items-center px-1 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Partners
            </Link>
            {user ? (
              <Link
                to="/studio"
                className="inline-flex min-h-9 items-center rounded-full bg-[#8b5cf6] py-2 pl-3 pr-4 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
              >
                <Plus className="size-4 mr-1.5 shrink-0" strokeWidth={2.5} />
                Open Studio
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="inline-flex min-h-10 items-center px-1 text-sm font-medium text-zinc-200 transition-colors hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth"
                  className="inline-flex min-h-9 items-center whitespace-nowrap rounded-full bg-[#8b5cf6] py-2 pl-3 pr-4 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
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
      {/* No negative top margin here: the nav is absolutely positioned (takes
          no flow space), so a -mt-14 only collapsed through the page root and
          shifted the whole route — nav included — 56px above the fold. */}
      <header className="relative flex min-h-screen flex-col justify-end overflow-hidden pb-20 px-5">
        {/* Slideshow — full-opacity stills only. (An ambient video used to sit
            under these at 75% with the stills at 25%; the two bled into each
            other and read as a half-transparent "stuck" clip.) */}
        <div className="absolute inset-0 z-0">
          {heroSlides.map((slide, i) => (
            <ResponsiveImage
              key={slide.src}
              src={slide.src}
              sizes="100vw"
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

        {/* The hero photo itself is tappable — recreate the current look in
            Studio with a matching prompt prefilled. Sits above the image
            (z-[1]) but below the text content, CTAs and dots (z-10). */}
        <Link
          to="/studio"
          search={{ q: heroSlides[slideIdx]?.refPrompt }}
          aria-label="Recreate this look in Studio"
          onClick={() => void track("hero_photo_click", { slide: heroSlides[slideIdx]?.src })}
          className="absolute inset-0 z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8b5cf6]"
        />

        {/* Text content — all slides absolutely stacked; active one fades in */}
        <div className="relative z-10 max-w-sm">
          {/* Spacer that keeps the container tall enough for the longest slide */}
          <div aria-hidden className="invisible pointer-events-none select-none">
            <div className="mb-5 flex items-center gap-3">
              <span className="size-1.5" />
              <span className="font-serif italic text-2xl font-semibold leading-tight">Flagship Feature</span>
              <span className="px-2 py-0.5 text-[10px]">★ Pro</span>
            </div>
            <div className="text-[2.45rem] font-semibold leading-[0.97] tracking-tight sm:text-[2.7rem]">
              Go Viral On TikTok In 30 Seconds.
            </div>
            <p className="mt-5 text-base leading-relaxed">
              Turn one idea into an entire month of scroll-stopping content. Aurora creates 30 unique
              TikToks, lyric videos, teasers, cover reveals, reels, and promo posts ready to publish.
            </p>
            <span className="mt-6 inline-flex text-sm font-bold">TikTok 30 →</span>
          </div>

          {/* All slides — absolutely positioned so they don't affect layout height */}
          {heroSlides.map((slide, i) => (
            <div
              key={slide.src}
              className={`absolute inset-0 transition-opacity duration-700 ${
                i === slideIdx ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="mb-5 flex items-center gap-3 drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]">
                <span className="inline-block size-1.5 shrink-0 rounded-full bg-primary animate-pulse" />
                <span className="font-serif italic text-2xl font-semibold text-white/90 normal-case tracking-normal leading-tight">
                  <EditableCopy copyKey={`landing_hero_${i}_eyebrow`} fallback={slide.eyebrow} />
                </span>
                {"badge" in slide && slide.badge && (
                  <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 not-italic">
                    <EditableCopy copyKey={`landing_hero_${i}_badge`} fallback={slide.badge} />
                  </span>
                )}
              </div>
              <h1 className="text-[2.45rem] font-semibold leading-[0.97] tracking-tight text-white sm:text-[2.7rem]">
                <EditableStaggeredHeadline
                  copyKey={`landing_hero_${i}_headline`}
                  fallback={slide.headline}
                  className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent"
                />
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

          {/* Buttons always visible below the slide text area */}
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
          {heroSlides.map((_, i) => (
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

      <section className="border-b border-white/8 bg-[#08080e] px-5 py-12">
        <ScrollReveal className="mx-auto max-w-5xl">
          <div className="mb-5 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#a78bfa]">See it in action</span>
            <h2 className="mt-2 text-3xl font-semibold text-white">A real Aurora output, from direction to delivery.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
              Watch the kind of cinematic performance Aurora is built to take from a creative brief to the feed.
            </p>
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-[0_24px_80px_-30px_rgba(139,92,246,0.55)]">
            <DemoMedia
              asset={DEMO_ASSETS.landing.walkthrough}
              autoPlay={false}
              controls
              priority
              className="aspect-video w-full object-cover"
            />
          </div>
        </ScrollReveal>
      </section>

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
      {/* Never give a landing element the id `process`: browsers expose
          element ids as window globals, so `window.process` became this
          <section> and Vite's dev-time `process.env.TSS_SERVER_FN_BASE`
          define landed on a DOM node. Once hydration swapped the node, every
          route that lazy-loaded a server function from the landing — /auth
          included — crashed at import time with "reading
          'TSS_SERVER_FN_BASE'". Guarded by reserved-dom-ids.test.ts. */}
      <section id="how-it-works" className="px-5 py-12">
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
        <OutputGallery
          items={DEMO_ASSETS.landing.studio}
          kicker="Studio proof"
          title="A reference becomes a campaign world."
          subtitle="Look through the kinds of visual direction Aurora Studio turns into finished assets."
          showGalleryLink
        />
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
            <EditableCopy copyKey="landing_tools_blurb" fallback={`Every feature is credit based. No subscriptions required to start. ${ONBOARDING_BONUS_AURA} free Aura when you complete setup.`} />
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featuredTools.map((tool) => (
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

      {/* ── Frontier Model Spotlight ───────────────────────────────────── */}
      <ScrollReveal><Suspense fallback={null}><ModelSpotlight /></Suspense></ScrollReveal>

      {/* ── App Screenshots — "Inside Aurora" ────────────────────────── */}
      <ScrollReveal><Suspense fallback={null}><AppScreenshotsSection /></Suspense></ScrollReveal>
      <OutputGallery
        items={DEMO_ASSETS.landing.colors}
        kicker="Colors Studio"
        title="Grade the feeling before you commit."
        subtitle="Palette choices shown on finished Aurora frames, not color chips alone."
        className="px-5"
        showGalleryLink
      />

      {/* ── UGC Ads (gateable — hidden in artist-only mode) ──────────── */}
      {showFeature("ugc") && (
        <ScrollReveal>
          <Suspense fallback={null}><UGCAdsSection /></Suspense>
          <OutputGallery
            items={DEMO_ASSETS.landing.ugc}
            kicker="UGC proof"
            title="A brief people can see themselves in."
            subtitle="Creator presence, product focus, and the final campaign outcome in one visual story."
            className="px-5"
            showGalleryLink
          />
        </ScrollReveal>
      )}

      {/* ── Viral Engine (TikTok30/Spin — gateable) ──────────────────── */}
      {showFeature("spin") && (
        <ScrollReveal>
          <Suspense fallback={null}><ViralEngine /></Suspense>
          <OutputGallery
            items={DEMO_ASSETS.landing.spin}
            kicker="TikTok30 proof"
            title="One direction. A month of distinct posts."
            subtitle="Templates, campaign stills, and moving vertical output from the same creative lane."
            className="px-5"
            showGalleryLink
          />
        </ScrollReveal>
      )}

      {/* ── Every Face Sings (lip-sync demo) ─────────────────────────── */}
      <Suspense fallback={null}><BalloonLipsync /></Suspense>

      {/* ── CLI — whole studio from your terminal ────────────────────── */}
      <ScrollReveal><Suspense fallback={null}><CliSection /></Suspense></ScrollReveal>
      <OutputGallery
        items={DEMO_ASSETS.landing.canvas}
        kicker="Canvas workflow"
        title="Plan the world, then connect the shots."
        subtitle="Reference frames, scene direction, and a finished motion result in one visual workflow."
        className="px-5"
        showGalleryLink
      />

      {/* ── Playground teaser ────────────────────────────────────────── */}
      <section className="relative z-10 px-5 py-16 border-t border-white/5">
        <div className="rounded-3xl border border-white/8 bg-zinc-900/60 overflow-hidden">
          {/* faint grid overlay */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "linear-gradient(white 1px,transparent 1px),linear-gradient(90deg,white 1px,transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative px-6 py-10 flex flex-col gap-6">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-400/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-violet-300">
                {"</>"}  Playground
              </span>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                Script the studio{" "}
                <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-violet-400 bg-clip-text text-transparent">
                  with code.
                </span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400 max-w-[44ch]">
                Write small scripts against the pre-authenticated <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-violet-300">aurora</code> client — batches, pipelines, experiments. Runs are sandboxed in your browser and spend your real Aura.
              </p>
            </div>

            <ul className="flex flex-wrap gap-2">
              {["Sandboxed in-browser", "Spends real Aura", "Same models as Studio"].map((f) => (
                <li key={f} className="flex items-center gap-1.5 rounded-full bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300">
                  <span className="size-1.5 rounded-full bg-violet-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            {/* Code preview */}
            <div className="rounded-2xl border border-white/10 bg-[#0d0d14] overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/6 bg-white/[0.02]">
                <span className="size-2.5 rounded-full bg-red-500/70" />
                <span className="size-2.5 rounded-full bg-yellow-500/70" />
                <span className="size-2.5 rounded-full bg-green-500/70" />
                <span className="ml-3 text-[10px] text-zinc-600 font-mono">script.js</span>
              </div>
              <pre className="px-5 py-4 text-[12px] leading-relaxed font-mono text-zinc-400 overflow-x-auto whitespace-pre-wrap">
                <span className="text-zinc-600">{"// Scripts run sandboxed — real Aura, real models."}{"\n"}</span>
                <span className="text-zinc-500">{"const "}</span><span className="text-violet-300">{"res"}</span><span className="text-zinc-500">{" = await "}</span><span className="text-cyan-300">{"aurora"}</span><span className="text-zinc-400">{"."}</span><span className="text-emerald-300">{"image"}</span><span className="text-zinc-400">{"("}</span><span className="text-amber-300">{'"a tiny astronaut sticker"'}</span><span className="text-zinc-400">{")"}{"\n"}</span>
                <span className="text-cyan-300">{"aurora"}</span><span className="text-zinc-400">{"."}</span><span className="text-emerald-300">{"show"}</span><span className="text-zinc-400">{"(res.url, "}</span><span className="text-amber-300">{'"Tiny astronaut"'}</span><span className="text-zinc-400">{")"}</span>
              </pre>
            </div>

            <Link
              to="/editor"
              className="self-start inline-flex items-center gap-2 rounded-full bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-[0_6px_24px_-4px_rgba(139,92,246,0.55)] transition-transform hover:scale-[1.02] active:scale-95 no-underline"
            >
              Open Playground <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

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
        {/* Every card is tappable — lightbox with the full output + a
            "Create something like this" deep link into the right tool. */}
        <Suspense fallback={null}>
          <PhotoStrip
            rows={[
              {
                direction: "left",
                duration: 38,
                className: "mb-3",
                items: [
                  { src: "/josh-ref-1.png",         alt: "NBA Josh — artist promo",   tag: <EditableCopy copyKey="landing_marquee_r1_1_tag" fallback="Promo"     />, createTo: "/studio", prompt: "Artist promo shot, dramatic stage lighting, cinematic film grain" },
                  { src: "/landing-client-2.png",   alt: "Editorial shoot",           tag: <EditableCopy copyKey="landing_marquee_r1_2_tag" fallback="Editorial" />, createTo: "/studio", prompt: "Editorial fashion shoot, deep shadows, magazine-quality styling" },
                  { src: "/landing-client-4.png",   alt: "Backstage promo",           tag: <EditableCopy copyKey="landing_marquee_r1_3_tag" fallback="Promo"     />, createTo: "/studio", prompt: "Backstage promo photo, candid energy, warm tungsten light" },
                  { src: "/landing-photo-3.jpeg",   alt: "Album artwork",             tag: <EditableCopy copyKey="landing_marquee_r1_4_tag" fallback="Cover art" />, createTo: "/studio", prompt: "Album cover artwork, bold graphic composition, moody color palette" },
                  { src: "/spotlight/ski-selfie.jpeg", alt: "Ski day reference",      tag: <EditableCopy copyKey="landing_marquee_r1_5_tag" fallback="Ski day"   />, createTo: "/studio", prompt: "Ski day lifestyle shot, bright alpine light, candid selfie framing" },
                ],
              },
              {
                direction: "right",
                duration: 30,
                items: [
                  { src: "/landing-client-5.png",   alt: "Concert energy",              tag: <EditableCopy copyKey="landing_marquee_r2_1_tag" fallback="Concert"   />, createTo: "/colors" },
                  { src: "/josh-scene-still.jpeg",  alt: "NBA Josh — scene still",      tag: <EditableCopy copyKey="landing_marquee_r2_2_tag" fallback="Cinema"    />, createTo: "/music-video" },
                  { src: "/landing-client-7.png",   alt: "Editorial glam",              tag: <EditableCopy copyKey="landing_marquee_r2_3_tag" fallback="Glam"      />, createTo: "/studio", prompt: "Editorial glam portrait, studio strobes, high-fashion retouch" },
                  { src: "/landing-photo-5.jpeg",   alt: "Cinematic scene",             tag: <EditableCopy copyKey="landing_marquee_r2_4_tag" fallback="Cinema"    />, createTo: "/music-video" },
                  { src: "/landing-photo-6.png",    alt: "Color grade",                 tag: <EditableCopy copyKey="landing_marquee_r2_5_tag" fallback="Color"     />, createTo: "/colors" },
                ],
              },
            ]}
          />
        </Suspense>
      </section>

      {/* ── Tool Directory ───────────────────────────────────────────────── */}
      <section className="border-b border-white/8 bg-[#0a0910] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.34em] text-violet-300">Every Aurora tool</span>
              <h2 className="mt-4 max-w-3xl text-[clamp(2.75rem,8vw,6.5rem)] font-black uppercase leading-[0.83] tracking-[-0.055em] text-zinc-100">
                Create<br />
                <span className="text-transparent [-webkit-text-stroke:1px_rgba(255,255,255,0.56)]">something</span><br />
                new.
              </h2>
            </div>
            <p className="max-w-[30ch] text-sm leading-relaxed text-zinc-500 sm:text-right">
              One balance across every tool. Prices below use Aurora&apos;s live Aura economy.
            </p>
          </div>

          <div className="border-t border-white/10">
            {toolDirectory.map((tool) => (
              <Link
                key={tool.name}
                to={tool.to}
                className="group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 py-4 no-underline transition-colors hover:bg-white/[0.035] sm:grid-cols-[3.5rem_minmax(10rem,1fr)_minmax(10rem,0.8fr)_auto_auto] sm:gap-5 sm:px-4"
              >
                <span className="text-xs font-semibold tabular-nums text-zinc-600">{tool.number}</span>
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="text-lg font-black uppercase tracking-tight text-zinc-100 transition-colors group-hover:text-violet-300 sm:text-2xl">{tool.name}</span>
                  {tool.label && <span className="hidden rounded-sm bg-violet-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.13em] text-violet-200 ring-1 ring-violet-300/25 sm:inline">{tool.label}</span>}
                </div>
                <span className="hidden text-right text-xs text-zinc-500 sm:block">{tool.description}</span>
                <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] font-bold tabular-nums text-zinc-300 ring-1 ring-white/10">{tool.price}</span>
                <ArrowUpRight className="size-4 text-zinc-600 transition-colors group-hover:text-violet-300" />
              </Link>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between gap-4 text-xs text-zinc-500">
            <span>Plans and Aura top-ups available anytime</span>
            <Link to="/tools" className="font-semibold text-violet-300 hover:text-white">Explore all tools →</Link>
          </div>
        </div>
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
          {/* Poster image paints instantly while the video buffers. The clip is
              a real Aurora music-video render (9:16); a 4:5 frame keeps the
              artist and the neon alley readable instead of a 16:9 mid-crop. */}
          <img
            src={reelPoster}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden
          />
          <video
            src={reelClip}
            poster={reelPoster}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="aspect-[4/5] w-full object-cover relative"
            aria-label="Aurora-generated cinematic music video — artist in a neon rain-soaked alley"
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

      {/* ── Featured Artist ─────────────────────────────────────────────── */}
      <Suspense fallback={null}><FeaturedArtist /></Suspense>

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

      <Suspense fallback={null}><PricingSection /></Suspense>

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

      <Suspense fallback={null}><FinalCTA /></Suspense>

      {/* ── Collaborators strip — platforms Aurora plugs into ───────────── */}
      <Suspense fallback={null}><CollaboratorsStrip /></Suspense>

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
              { label: "Lip Sync", to: "/lipsync" },
              ...(showFeature("spin") ? [{ label: "TikTok30", to: "/spin" }] : []),
              { label: "Gallery", to: "/gallery" },
            ]}
          />
          <FooterCol
            title="Develop"
            links={[
              { label: "Playground", to: "/editor" },
              { label: "CLI", to: "/cli" },
              { label: "MCP", to: "/studio" },
              { label: "Privacy", to: "/" },
              { label: "Terms", to: "/" },
            ]}
          />
        </div>
        <div className="border-t border-white/5 pt-6 text-xs text-zinc-600">
          © {new Date().getFullYear()} Aurora Performance Studio. Built by pro artists, for artists who scale.
        </div>
      </footer>

      <Suspense fallback={null}><AdminLandingEditor /></Suspense>
      <div className="h-24" aria-hidden />
    </div>
  );
}

function FeaturedToolRow({ tool }: { tool: (typeof FEATURED_TOOLS)[number] }) {
  const Icon = tool.icon;
  const { isHiddenFromUsers } = useFeatureVisibility();
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
          <p className="text-sm font-semibold leading-tight text-zinc-100">{tool.label}<HiddenBadge show={isHiddenFromUsers(tool.feature ?? featureKeyForRoute(tool.to))} /></p>
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
          <ResponsiveImage
            src={image}
            sizes="(min-width: 760px) 50vw, 100vw"
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

const FeaturedArtist = lazy(() =>
  import("@/components/landing/FeaturedArtist").then((m) => ({ default: m.FeaturedArtist })),
);
