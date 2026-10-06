import { Link } from "@tanstack/react-router";
import { DemoMedia } from "@/components/visual/DemoMedia";
import type { DemoMediaAsset } from "@/lib/demo-assets";
import { cn } from "@/lib/utils";

export type PageHeroBannerProps = {
  /** Short all-caps label above the headline. */
  kicker?: string;
  /** Main headline — plain text; the gradient accent is applied by this component. */
  headline: string;
  /** Optional supporting line below the headline. */
  sub?: string;
  /** Legacy video prop retained for small route-specific callers. */
  videoSrc?: string;
  /** Named Aurora output with its poster, alt text, and fallback behavior. */
  media?: DemoMediaAsset;
  /** Optional CTA button rendered below the sub-text. */
  ctaLabel?: string;
  ctaHref?: string;
  /**
   * Compact mode: reduces vertical padding and hides the sub-text on mobile.
   * Use on tool-like pages (Content Line, UGC) where the banner is a slim
   * orientation strip, not a full marketing hero.
   */
  compact?: boolean;
  className?: string;
};

/**
 * PageHeroBanner — shared cinematic page-level hero.
 *
 * Insertion rules (from Task 378 audit):
 *   - /studio    : above StudioHeroComposer in the left sidebar slot
 *   - /colors    : immediately below the header, full-width
 *   - /lipsync   : replaces/wraps the existing kicker+h1 section
 *   - /spin      : between the h1 block and the template picker grid
 *   - /ugc       : replaces the raw <section> wrapping the kicker+h1
 *   - /ugc-line  : compact variant, above the tab bar (optional)
 *
 * DO NOT render on: /canvas, /edit, /video-agent, /nexusarb.
 * These are full-screen editors that own the whole viewport.
 */
export function PageHeroBanner({
  kicker,
  headline,
  sub,
  videoSrc,
  media,
  ctaLabel,
  ctaHref,
  compact = false,
  className,
}: PageHeroBannerProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden aurora-visual-banner",
        compact ? "py-8" : "py-14",
        className,
      )}
    >
      {/* Ambient video background */}
      {(media || videoSrc) && (
        <DemoMedia
          asset={media ?? {
            id: "ambient-video",
            src: videoSrc!,
            type: "video",
            alt: "",
          }}
          priority
          className="absolute inset-0 size-full object-cover opacity-30"
        />
      )}

      {/* Layered gradients — keeps legibility with or without video */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[oklch(0.10_0.025_272)] via-transparent to-[oklch(0.10_0.025_272)/0]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, oklch(0.60 0.27 295 / 0.12), transparent 70%)",
        }}
      />
      {/* Vignette overlay so text remains readable over video */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/60"
      />

      {/* Content */}
      <div className="relative z-10 px-6 aurora-visual-banner-content">
        {kicker && (
          <p className="aurora-kicker mb-3">{kicker}</p>
        )}

        <h1
          className={cn(
            "font-display font-extrabold tracking-tight leading-[0.95]",
            compact
              ? "text-2xl"
              : "text-3xl",
          )}
        >
          <span className="aurora-gradient-text">{headline}</span>
        </h1>

        {sub && (
          <p
            className={cn(
              "mt-3 max-w-xl text-foreground/70 leading-relaxed",
              compact ? "text-sm aurora-visual-compact-sub" : "text-base",
            )}
          >
            {sub}
          </p>
        )}

        {ctaLabel && ctaHref && (
          <Link
            to={ctaHref as "/studio"}
            className="mt-6 inline-flex items-center rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow-soft)] transition-transform hover:scale-[1.02] active:scale-95"
            style={{ background: "var(--gradient-hero)" }}
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
