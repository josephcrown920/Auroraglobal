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
import { ColorsTeaser } from "@/components/landing/ColorsTeaser";
import { JoshSlideshow } from "@/components/studio/JoshSlideshow";

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
  const ctaLabel = user ? "Open Performance Studio" : "Try it free";
  const greeting = user?.user_metadata?.display_name
    ? `Welcome back, ${String(user.user_metadata.display_name).split(" ")[0]}`
    : "Welcome to Aurora";
  const [tutorialTick, setTutorialTick] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const trackRef = useServerFn(trackAffiliateClick);

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

      {/* By Artists for Artists */}
      <div className="relative px-4 md:px-8 py-6">
        <div className="relative max-w-4xl mx-auto rounded-[28px] overflow-hidden border border-white/8 bg-gradient-to-br from-white/[0.03] to-transparent px-6 py-12 md:px-12 md:py-16 text-center">
          {/* glow */}
          <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-primary/20 blur-[100px]" />
          <div className="relative">

            {/* kicker */}
            <p className="text-[11px] uppercase tracking-[0.35em] text-primary/70 mb-5 font-semibold">
              ✦ Aurora Studio ✦
            </p>

            {/* headline */}
            <h2 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[0.95] uppercase">
              <span className="block text-white">By Artists,</span>
              <span className="block aurora-gradient-text">For Artists.</span>
            </h2>

            {/* genre/creator identity tags */}
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {["Afrobeats", "Trap & Drill", "R&B", "Pop", "Dance", "Hip-Hop", "Dancehall", "Gospel", "Amapiano"].map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-medium text-white/55"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* proof stats */}
            <div className="mt-8 flex justify-center gap-0 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden max-w-sm mx-auto">
              {[
                { n: "40+", l: "AI models" },
                { n: "30", l: "Posts per run" },
                { n: "5", l: "Platforms" },
              ].map((s) => (
                <div key={s.l} className="flex-1 py-4 flex flex-col items-center gap-0.5">
                  <span className="text-xl font-black text-white">{s.n}</span>
                  <span className="text-[9px] uppercase tracking-wider text-white/35">{s.l}</span>
                </div>
              ))}
            </div>

            {/* tagline */}
            <p className="mt-6 text-white/40 text-sm max-w-xs mx-auto leading-relaxed">
              Built by creators who needed it.<br />For creators who deserve it.
            </p>

            {/* CTA */}
            <div className="mt-7 flex flex-col items-center gap-3">
              <Link
                to="/studio"
                onClick={() => void track("manifesto_cta_click")}
                className="group inline-flex items-center gap-2.5 px-8 py-3.5 text-base font-bold rounded-full text-white no-underline bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)] hover:brightness-110 hover:scale-[1.02] transition-all"
              >
                Start creating free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <p className="text-[11px] text-white/30 tracking-wide">
                No credit card · Free credits on signup · Cancel anytime
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 0a. Direct your shoot — auto-scrolling slideshow */}
      <section className="px-6 md:px-12 pt-6 pb-2">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Direct your{" "}
            <span className="aurora-gradient-text">
              shoot.
            </span>
          </h2>
          <p className="text-white/65 mt-2">
            Drop references → write direction → generate. That's it.
          </p>
          <div className="mt-6">
            <JoshSlideshow />
          </div>

          {/* Real performance shots — mini reference boxes */}
          <div className="mt-3 flex gap-2">
            {[
              { src: "/josh/josh-concert-performance.webp", label: "Live concert" },
              { src: "/josh/josh-orange-performance.jpg", label: "Orange studio" },
              { src: "/josh/josh-pink-leather-mic.jpg", label: "Pink leather" },
            ].map((p) => (
              <div
                key={p.src}
                className="relative flex-1 aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/40"
              >
                <img
                  src={p.src}
                  alt={p.label}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-[10px] font-medium text-white/90 truncate">{p.label}</p>
                </div>
              </div>
            ))}
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

      {/* 1. Templates strip — right below hero */}
      <TrendingTemplatesStrip />

      {/* 2. Trust bar — earn credibility before asking for anything */}
      <TrustBar />

      {/* 3. Services — show what Aurora does */}
      <ServicesGrid />

      {/* 4. Contact form — ask for action while interest is high */}
      <HeroContactForm greeting={greeting} />

      {/* 5. TikTok30 viral engine */}
      <ViralEngine />

      {/* 6. Canvas + finished workflows + UGC Factory */}
      <CanvasWorkflowShowcase />

      {/* 7. Perform Anywhere + Motion Control */}
      <PerformAnywhereSection />

      {/* 8. Colors Studio showcase */}
      <ColorsTeaser />

      {/* 9. Get Ready With Me */}
      <GetReadyWithMe />

      {/* 10. Supercomputer / product hero */}
      <SupercomputerSection />

      {/* 11. Why us */}
      <WhyUs />

      {/* 12. Reviews */}
      <Testimonials />

      {/* 13. Affiliate rewards */}
      <AffiliateRewardSection />

      {/* 14. Final CTA */}
      <FinalCTA />

      {/* CLI section — developer-focused, re-enable when CLI is consumer-ready */}
      {/* <CliSection /> */}
      {/* Feature request — re-enable post-launch */}
      {/* <FeatureRequest /> */}

      <SiteFooter />
    </main>
  );
}
