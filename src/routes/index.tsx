import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, ArrowRight, BookOpen, Wand2, Palette, Megaphone, Plug } from "lucide-react";
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
import { TikTokSection } from "@/components/landing/TikTokSection";
import { AffiliateRewardSection } from "@/components/landing/AffiliateRewardSection";
import { CanvasWorkflowShowcase } from "@/components/landing/CanvasWorkflowShowcase";
import { ColorsTeaser } from "@/components/landing/ColorsTeaser";
import { BalloonLipsync } from "@/components/landing/BalloonLipsync";
import { JoshSlideshow } from "@/components/studio/JoshSlideshow";

import { SupercomputerSection } from "@/components/landing/ScreenshotSections";
import { FeatureRequest } from "@/components/landing/FeatureRequest";
import { track } from "@/lib/tracking";

const FAQ_ITEMS = [
  { q: "How does Aurora work?", a: "1 Aurora ≈ 1 image. Videos cost 5 Aurora (5s) or 10 Aurora (10s). Lip-sync is 1 Aurora per second. Aurora never expires and rolls across all models." },
  { q: "Can I use the results commercially?", a: "Yes. Every paid plan includes a full commercial license for the outputs you generate — ads, music videos, UGC, client deliverables. You own the renders." },
  { q: "Which models are included?", a: "All of them. Seedance 2.0, Kling 3.0, Nano Banana Pro, Seedream 4.5, Sync 1.9 lip-sync, and every new model we ship." },
];

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Aurora Studio — Image, video, canvas, UGC, motion, lip-sync, colors" },
      { name: "description", content: "Seven AI creative tools in one studio: image generation, video generation, canvas, UGC ads factory, motion control, lip-sync, and the colors studio." },
      { property: "og:title", content: "Aurora Studio — Seven tools, one studio" },
      { property: "og:description", content: "Image, video, canvas, UGC ads, motion control, lip-sync and colors — every Aurora tool, one place." },
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
  const trackRef = useServerFn(trackAffiliateClick);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) {
      try { localStorage.setItem("aurora_ref", ref); } catch {}
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
      <ScrollProgress />
      <StickyCreditsBar />

      {/* Ambient violet glows */}
      <div className="pointer-events-none absolute -top-40 -right-40 size-[640px] rounded-full blur-3xl opacity-50"
        style={{ background: "radial-gradient(circle, hsl(270 90% 60% / 0.55), transparent 60%)" }} />
      <div className="pointer-events-none absolute top-1/3 -left-40 size-[520px] rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, hsl(290 80% 55% / 0.5), transparent 60%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

      {/* Sticky header */}
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
          scrolled ? "bg-[#070612]/85 backdrop-blur-xl border-b border-white/10" : "bg-transparent"
        }`}
      >
        <div className="flex items-center justify-between px-6 md:px-12 py-4">
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
            <img src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
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
            <Link to="/canvas" className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5 no-underline">
              <Sparkles className="size-3.5" /> Canvas
            </Link>
            <Link to="/ugc" className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5 no-underline">
              <Megaphone className="size-3.5" /> UGC
            </Link>
            <Link to="/colors" className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5 no-underline">
              <Palette className="size-3.5" /> Colors
            </Link>
            <Link to="/motion" className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5 no-underline">
              <Wand2 className="size-3.5" /> Motion
            </Link>
            <Link to="/lipsync" className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5 no-underline">
              <Wand2 className="size-3.5" /> Lip Sync
            </Link>
            <Link to="/connect" className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full text-white/80 hover:text-white hover:bg-white/5 no-underline">
              <Plug className="size-3.5" /> Connect Claude
            </Link>
            {user ? (
              <Link to="/dashboard" className="px-3 py-1.5 text-sm rounded-full border border-white/15 text-white/90 hover:bg-white/5 no-underline">Dashboard</Link>
            ) : (
              <Link to="/auth" className="px-3 py-1.5 text-sm rounded-full border border-white/15 text-white/90 hover:bg-white/5 no-underline">Sign in</Link>
            )}
            <Link
              to="/studio"
              onClick={() => void track("header_cta_click")}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-full font-medium text-white no-underline bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-95 shadow-lg shadow-violet-500/30"
            >
              {ctaLabel} <ArrowRight className="size-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-20" />

      {/* 0a. Direct your shoot — auto-scrolling slideshow */}
      <section className="px-6 md:px-12 pt-6 pb-2">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Direct your <span className="bg-gradient-to-r from-fuchsia-400 to-violet-400 bg-clip-text text-transparent">shoot.</span>
          </h2>
          <p className="text-white/65 mt-2">Drop references → write direction → generate. That's it.</p>
          <div className="mt-6">
            <JoshSlideshow />
          </div>
        </div>
      </section>

      {/* 0. Viral engine — TikTok hook moved to the very top */}
      <ViralEngine />

      {/* 0b. TikTok marketing section */}
      <TikTokSection />

      {/* 1. Balloon head lip-sync visualizer — sits right below TikTok hook */}
      <BalloonLipsync />

      {/* 2. Hero + "Talk to Aurora" contact form */}
      <HeroContactForm greeting={greeting} />

      {/* 3. Published CLI */}
      <CliSection />

      {/* 4. Supercomputer / product hero */}
      <SupercomputerSection />

      {/* 5. Our services */}
      <ServicesGrid />

      {/* 6. Canvas + finished workflows + UGC Factory */}
      <CanvasWorkflowShowcase />

      {/* 6b. Colors Studio teaser */}
      <ColorsTeaser />

      {/* 7. Trust + Why us */}
      <TrustBar />
      <WhyUs />

      {/* 8. Reviews */}
      <Testimonials />

      {/* 8b. Affiliate rewards */}
      <AffiliateRewardSection />

      {/* 9. Final CTA */}
      <FinalCTA />

      {/* 10. Request a feature */}
      <FeatureRequest />

      <SiteFooter />
    </main>
  );
}
