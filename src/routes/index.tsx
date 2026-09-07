import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useCallback, useState, useEffect } from "react";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import { LANDING_IMAGE_SRCSET } from "@/lib/landing-image-manifest";

// Section Components
import { NavSection } from "@/components/landing/NavSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { DemoWalkthroughSection } from "@/components/landing/DemoWalkthroughSection";
import { CategoryStripSection } from "@/components/landing/CategoryStripSection";
import { TickerSection } from "@/components/landing/TickerSection";
import { ProcessSection } from "@/components/landing/ProcessSection";
import { FeaturedToolsSection } from "@/components/landing/FeaturedToolsSection";
import { CapabilitiesSection } from "@/components/landing/CapabilitiesSection";
import { GallerySection } from "@/components/landing/GallerySection";
import { ToolDirectorySection } from "@/components/landing/ToolDirectorySection";
import { VideoReelSection } from "@/components/landing/VideoReelSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { DirectorChairSection } from "@/components/landing/DirectorChairSection";
import { PartnersSection } from "@/components/landing/PartnersSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FooterSection } from "@/components/landing/FooterSection";
import { BottomCTASection } from "@/components/landing/BottomCTASection";
import { lazy } from "react";

// Lazy-loaded sections
const IntroAnimation = lazy(() =>
  import("@/components/landing/IntroAnimation").then((m) => ({ default: m.IntroAnimation })),
);

const AdminLandingEditor = lazy(() =>
  import("@/components/AdminLandingEditor").then((m) => ({ default: m.AdminLandingEditor })),
);

const INTRO_SEEN_KEY = "aurora_intro_seen";

function shouldShowIntro() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) !== "1";
  } catch {
    return true;
  }
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aurora — Turn Your Phone Recording into a Cinematic Music Video" },
      {
        name: "description",
        content:
          "Create videos that look like a $50,000 production — for a fraction of the cost. Aurora is the AI studio built for music artists and creators. No crew, no studio.",
      },
      { property: "og:title", content: "Aurora — Turn Your Phone Recording into a Cinematic Music Video" },
      {
        property: "og:description",
        content:
          "Create videos that look like a $50,000 production — for a fraction of the cost. Aurora is the AI studio built for music artists and creators. No crew, no studio.",
      },
      { property: "og:url", content: CANONICAL_ORIGIN },
    ],
    links: [
      { rel: "canonical", href: CANONICAL_ORIGIN },
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
                text: "Creator ($25/month) gives you clean exports, full video access, and 1,000 Aura per month — enough for regular creators. Pro ($79/month) adds priority rendering, the highest-quality models.",
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

function LandingPage() {
  const [introVisible, setIntroVisible] = useState(shouldShowIntro);

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
    <div className="relative min-h-screen bg-zinc-950 text-zinc-100 font-display antialiased selection:bg-[#8b5cf6] selection:text-white">
      <Suspense fallback={null}>{introVisible && <IntroAnimation onDone={handleIntroDone} />}</Suspense>

      <NavSection />
      <HeroSection />
      <DemoWalkthroughSection />
      <CategoryStripSection />
      <TickerSection />
      <ProcessSection />
      <FeaturedToolsSection />
      <CapabilitiesSection />
      <GallerySection />
      <ToolDirectorySection />
      <VideoReelSection />
      <TestimonialsSection />
      <DirectorChairSection />
      <PartnersSection />
      <FaqSection />
      <BottomCTASection />
      <FooterSection />

      <Suspense fallback={null}><AdminLandingEditor /></Suspense>
      <div className="h-24" aria-hidden />
    </div>
  );
}
