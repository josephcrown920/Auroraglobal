import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Wand2,
  Palette,
  Megaphone,
  Plug,
  TrendingUp,
  Terminal,
  Camera,
  Play,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";
import { useServerFn } from "@tanstack/react-start";
import { trackAffiliateClick } from "@/lib/affiliate.functions";
import { useAuth } from "@/hooks/use-auth";
import { useSiteImage } from "@/components/landing/SiteImagesProvider";
import { TutorialModal } from "@/components/TutorialModal";
import { SiteFooter } from "@/components/SiteFooter";
import { Testimonials } from "@/components/landing/Testimonials";
import { TrustBar } from "@/components/landing/TrustBar";
import { StickyCreditsBar } from "@/components/landing/StickyCreditsBar";
import { ScrollProgress } from "@/components/landing/ScrollProgress";
import { HeroContactForm } from "@/components/landing/HeroContactForm";
import { ServicesGrid } from "@/components/landing/ServicesGrid";
import { WhyUs } from "@/components/landing/WhyUs";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { CliSection } from "@/components/landing/CliSection";
import { ViralEngine } from "@/components/landing/ViralEngine";
import { AffiliateRewardSection } from "@/components/landing/AffiliateRewardSection";
import { CanvasWorkflowShowcase } from "@/components/landing/CanvasWorkflowShowcase";
import { GetReadyWithMe } from "@/components/landing/GetReadyWithMe";
import { TrendingTemplatesStrip } from "@/components/landing/TrendingTemplatesStrip";
import { PhotoStrip } from "@/components/landing/PhotoStrip";
import { ColorsTeaser } from "@/components/landing/ColorsTeaser";
import { CreatorEconomySection } from "@/components/landing/CreatorEconomySection";

import { SupercomputerSection } from "@/components/landing/ScreenshotSections";
import { FeatureRequest } from "@/components/landing/FeatureRequest";
import { track } from "@/lib/tracking";
import { LandingDemoModal } from "@/components/landing/LandingDemoModal";
import { PerformAnywhereSection } from "@/components/landing/PerformAnywhereSection";

const FAQ_ITEMS = [
  {
    q: "How does Aura work?",
    a: "1 Aura ≈ 1 image. Budget video starts at 10 Aura and lip-sync at 3; premium models cost more, priced to match each model. Length and resolution scale the price. Aura never expires and rolls across all models.",
  },
  {
    q: "Can I use the results commercially?",
    a: "Yes. Every paid plan includes a full commercial license for the outputs you generate — ads, music videos, UGC, client deliverables. You own the renders.",
  },
  {
    q: "Which models are included?",
    a: "All of them. Seedance 2.0, Kling 3.0, Nano Banana Pro, Seedream 4.5, Sync 1.9 lip-sync, and every new model we ship.",
  },
];

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Aurora Studio — Go viral on TikTok in 30 seconds | Music Video AI" },
      {
        name: "description",
        content:
          "Drop your song and Aurora builds the music video — lip-sync, beat-synced visuals, cover-art reveals and lyric hooks. Built for TikTok music creators and Afrobeats, Trap & Drill artists.",
      },
      { property: "og:title", content: "Aurora — Drop your song, get your music video" },
      {
        property: "og:description",
        content:
          "AI music videos for artists: lip-sync, beat-sync visuals, cover art and lyric hooks. Go viral on TikTok in 30 seconds.",
      },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ITEMS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
});

function Index() {
  const { user } = useAuth();
  const ctaLabel = user ? "Open Performance Studio" : "Get started";
  const greeting = user?.user_metadata?.display_name
    ? `Welcome back, ${String(user.user_metadata.display_name).split(" ")[0]}`
    : "Welcome to Aurora";
  const [tutorialTick, setTutorialTick] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const trackRef = useServerFn(trackAffiliateClick);
  const hero1 = useSiteImage("hero_1");
  const hero2 = useSiteImage("hero_2");
  const hero3 = useSiteImage("hero_3");
  const hero4 = useSiteImage("hero_4");
  const hero5 = useSiteImage("hero_5");
  const hero6 = useSiteImage("hero_6");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      try {
        localStorage.setItem("aurora_ref", ref);
      } catch {
        // localStorage unavailable (e.g. private browsing) — non-fatal
      }
      trackRef({ data: { code: ref } }).catch(() => {});
    }
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [trackRef]);

  return (
    <main className="min-h-screen relative overflow-hidden bg-[#070612] text-white pb-28 md:pb-24">
      <TutorialModal trigger={tutorialTick} />
      <LandingDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <ScrollProgress />
      <StickyCreditsBar />

      {/* Ambient violet glows */}
      <div
        className="pointer-events-none absolute -top-40 -right-40 size-[640px] rounded-full blur-3xl opacity-50"
        style={{ background: "radial-gradient(circle, hsl(270 90% 60% / 0.55), transparent 60%)" }}
      />
      <div
        className="pointer-events-none absolute top-1/3 -left-40 size-[520px] rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, hsl(290 80% 55% / 0.5), transparent 60%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* Sticky header */}
      <header
        className={`phone-fixed-x fixed top-0 z-40 transition-all duration-300 ${
          scrolled ? "bg-[#070612]/85 backdrop-blur-xl border-b border-border" : "bg-transparent"
        }`}
      >
        <div className="flex items-center justify-between pl-24 pr-6 md:px-12 py-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold tracking-tight no-underline"
            onClick={(e) => {
              // Owner entrance: triple-click the logo within 800ms to open /admin.
              // Server still enforces has_role(), so non-admins get bounced.
              const w = window as unknown as { __logoClicks?: number[] };
              const now = Date.now();
              w.__logoClicks = [...(w.__logoClicks ?? []).filter((t) => now - t < 800), now];
              if (w.__logoClicks.length >= 3) {
                e.preventDefault();
                w.__logoClicks = [];
                window.location.href = "/admin";
              }
            }}
          >
            <img
              src={auroraLogo.url}
              alt="Aurora"
              decoding="async"
              className="size-8 rounded-xl object-contain shadow-[var(--shadow-glow-soft)]"
            />
            <span className="text-white">Aurora</span>
          </Link>
          <nav className="flex items-center gap-2 md:gap-3">
            <a
              href="#services"
              onClick={() => void track("nav_click", { target: "services" })}
              className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5 no-underline"
            >
              Services
            </a>
            <button
              onClick={() => setTutorialTick((t) => t + 1)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5"
            >
              <BookOpen className="size-3.5" /> Tutorials
            </button>
            <Link
              to="/canvas"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5 no-underline"
            >
              <Sparkles className="size-3.5" /> Canvas
            </Link>
            <Link
              to="/lipsync"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5 no-underline"
            >
              <Wand2 className="size-3.5" /> Lip Sync
            </Link>
            <Link
              to="/spin"
              search={{ prompt: undefined, jobId: undefined }}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5 no-underline"
            >
              <Play className="size-3.5" /> TikTok30
            </Link>
            {/* Lower-traffic tools consolidated behind one "More" menu instead of
                4 separate top-level links — cuts header nav clutter. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden lg:inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5">
                  More <ChevronDown className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/ugc" className="no-underline flex items-center">
                    <Megaphone className="size-3.5 mr-2" /> UGC Ads
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/motion" className="no-underline flex items-center">
                    <Wand2 className="size-3.5 mr-2" /> Motion
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/colors" className="no-underline flex items-center">
                    <Palette className="size-3.5 mr-2" /> Colors
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/reshoot" className="no-underline flex items-center">
                    <Camera className="size-3.5 mr-2" /> Reshoot
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {user ? (
              <Link
                to="/dashboard"
                className="px-3 py-1.5 text-sm rounded-full aurora-glass-strong text-foreground hover:brightness-110 no-underline"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                to="/auth"
                className="px-3 py-1.5 text-sm rounded-full aurora-glass-strong text-foreground hover:brightness-110 no-underline"
              >
                Sign in
              </Link>
            )}
            <Link
              to="/studio"
              onClick={() => void track("header_cta_click")}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-full font-medium text-white no-underline bg-[image:var(--gradient-hero)] hover:brightness-110 shadow-[var(--shadow-glow-soft)]"
            >
              {ctaLabel} <ArrowRight className="size-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-20" />

      {/* ── Hero — TikTok viral hook ────────────────────────────────────── */}
      <section className="relative px-6 md:px-12 pt-4 pb-10">
        <div className="max-w-6xl mx-auto grid gap-10 items-center" style={{ gridTemplateColumns: "1fr" }}>

          {/* Left: copy */}
          <div>
            {/* kicker */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[11px] font-semibold tracking-wide mb-6">
              <Sparkles className="size-3" /> Welcome to Aurora · Creativity lives here
            </div>

            {/* headline — white + solid violet, no pink drift */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
              <span className="text-white">Turn a selfie into a</span>{" "}
              <span className="text-primary">cinematic performance.</span>
            </h1>

            {/* sub */}
            <p className="mt-5 text-white/60 text-base md:text-lg leading-relaxed max-w-lg">
              One studio. Every model that matters — Seedance 2.0, Kling 3.0, Nano Banana Pro,
              Seedream 4.5, Sync lip-sync. Drop a photo, pick a vibe, get magazine-grade shots
              and motion in seconds.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/studio"
                onClick={() => void track("hero_cta_click", { variant: "primary" })}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-white no-underline bg-[image:var(--gradient-hero)] hover:brightness-110 shadow-[var(--shadow-glow-soft)] transition-all hover:scale-[1.02]"
              >
                <Play className="size-4 fill-current" /> Start creating — 5 Aura
              </Link>
              <a
                href="#pricing"
                onClick={() => void track("hero_cta_click", { variant: "pricing" })}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-medium text-white/80 no-underline aurora-glass-strong hover:brightness-110 transition-all"
              >
                See pricing
              </a>
            </div>

            {/* micro trust */}
            <div className="mt-6 flex flex-wrap gap-4 text-[11px] text-white/40 font-medium">
              <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary inline-block" /> 5 image models</span>
              <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary inline-block" /> 4 video models</span>
              <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary inline-block" /> Lip-sync built-in</span>
              <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary inline-block" /> 12,000+ creators</span>
            </div>
          </div>

          {/* Right: 2×3 photo grid */}
          <div className="grid grid-cols-3 gap-2 mt-8 sm:mt-0">
            {[
              { src: hero1, label: "Concert Wash" },
              { src: hero2, label: "Editorial" },
              { src: hero3, label: "Golden Hour" },
              { src: hero4, label: "Neon Dreams" },
              { src: hero5, label: "Rembrandt" },
              { src: hero6, label: "Violet Haze" },
            ].map((photo, i) => (
              <div
                key={photo.src}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 bg-white/5 group"
                style={{
                  animation: `photo-float ${2.4 + i * 0.28}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.15}s`,
                }}
              >
                <img
                  src={photo.src}
                  alt={photo.label}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    animation: `ken-burns ${18 + i * 3}s ease-in-out infinite alternate`,
                    animationDelay: `${i * -4}s`,
                  }}
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <span className="absolute bottom-2 left-2 text-[9px] font-semibold uppercase tracking-widest text-white/70">
                  {photo.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 1. Auto-scroll photo strip */}
      <PhotoStrip />

      {/* 2. TikTok30 viral engine — 30 posts hook */}
      <ViralEngine />

      {/* 3. Perform / Record Anywhere */}
      <PerformAnywhereSection />

      {/* 4. Colors Studio */}
      <ColorsTeaser />

      {/* 5. Multi-angle photoshoot */}
      <ServicesGrid />

      {/* 6. Canvas + UGC */}
      <CanvasWorkflowShowcase />

      {/* 7. Adult / creator economy */}
      <CreatorEconomySection />

      {/* 8. Templates strip */}
      <TrendingTemplatesStrip />

      {/* 9. Trust bar */}
      <TrustBar />

      {/* 10. Contact form */}
      <HeroContactForm greeting={greeting} />

      {/* 11. Get Ready With Me */}
      <GetReadyWithMe />

      {/* 12. Supercomputer / product hero */}
      <SupercomputerSection />

      {/* 13. Why us */}
      <WhyUs />

      {/* 14. Reviews */}
      <Testimonials />

      {/* 15. Affiliate rewards */}
      <AffiliateRewardSection />

      {/* 16. Final CTA */}
      <FinalCTA />

      {/* CLI section — developer-focused, re-enable when CLI is consumer-ready */}
      {/* <CliSection /> */}
      {/* Feature request — re-enable post-launch */}
      {/* <FeatureRequest /> */}

      <SiteFooter />
    </main>
  );
}
