import { Link } from "@tanstack/react-router";
import { Plus, ArrowUpRight, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { EditableCopy } from "@/components/EditableCopy";
import { ResponsiveImage } from "@/components/ui/responsive-image";
import { EditableStaggeredHeadline } from "@/components/visual/EditableStaggeredHeadline";
import { LANDING_IMAGE_SRCSET } from "@/lib/landing-image-manifest";
import { featureKeyForRoute, type FeatureKey } from "@/lib/feature-visibility";
import { useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { track } from "@/lib/tracking";
import { useState, useEffect } from "react";

const HERO_SLIDES: ReadonlyArray<{
  src: string;
  focus?: string;
  eyebrow: string;
  badge?: string;
  headline: string;
  sub: string;
  cta: string;
  ctaTo: string;
  refPrompt: string;
}> = [
  {
    src: "/hero/hero-direct-identity.png",
    focus: "object-right",
    eyebrow: "By Artists, for Artists",
    headline: "Direct Your Visual Identity.",
    sub: "The AI performance studio built by artists, for artists. Drop your references, direct the shoot in plain language, and ship studio-grade covers, promo, and cinematic performance reels.",
    cta: "Explore the studio →",
    ctaTo: "/studio",
    refPrompt: "Studio-grade artist portrait, dramatic red and blue stage lighting, cinematic film grain",
  },
  {
    src: "/hero/hero-perform-anywhere.png",
    eyebrow: "Flagship Feature",
    badge: "★ Pro",
    headline: "Perform Anywhere.",
    sub: "Stop renting studios, hiring crews, and waiting weeks for edits. Record yourself for 30 seconds on your iPhone — Aurora transforms your performance into cinematic music videos and visuals.",
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
    focus: "object-[70%_center]",
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
    focus: "object-[75%_center]",
    eyebrow: "Press Ready",
    badge: "★ Pro",
    headline: "Look Like The Biggest Artist In Your City.",
    sub: "Create magazine-quality press photos, tour posters, album covers, and promotional visuals in minutes—not weeks.",
    cta: "Create Press Photos →",
    ctaTo: "/music-video",
    refPrompt: "Magazine-quality press photo, editorial lighting, tour poster energy",
  },
];

export function HeroSection() {
  const { user } = useAuth();
  const ctaTo = user ? "/studio" : "/auth";
  const { showFeature } = useFeatureVisibility();

  const heroSlides = HERO_SLIDES.filter((s) => showFeature(featureKeyForRoute(s.ctaTo)));
  const [slideIdx, setSlideIdx] = useState(0);
  const slideCount = heroSlides.length;

  useEffect(() => {
    if (slideCount === 0) return;
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % slideCount), 5000);
    return () => clearInterval(t);
  }, [slideCount]);

  useEffect(() => {
    if (slideCount > 0 && slideIdx >= slideCount) setSlideIdx(0);
  }, [slideCount, slideIdx]);

  return (
    <header className="relative flex min-h-screen flex-col justify-end overflow-hidden pb-20 px-5">
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
              slide.focus ?? "object-center"
            } ${i === slideIdx ? "opacity-100" : "opacity-0"}`}
            fetchPriority={i === 0 ? "high" : "low"}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/25 to-transparent" />
      </div>

      <Link
        to="/studio"
        search={{ q: heroSlides[slideIdx]?.refPrompt }}
        aria-label="Recreate this look in Studio"
        onClick={() => void track("hero_photo_click", { slide: heroSlides[slideIdx]?.src })}
        className="absolute inset-0 z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#8b5cf6]"
      />

      <div className="relative z-10 max-w-sm">
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
                <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300 no-underline">
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
  );
}
