import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, X } from "lucide-react";
import { DemoMedia } from "@/components/visual/DemoMedia";
import type { DemoMediaAsset } from "@/lib/demo-assets";
import { cn } from "@/lib/utils";

export type OutputGalleryProps = {
  items: readonly DemoMediaAsset[];
  /**
   * Section heading shown above the grid.
   * Omit to render only the grid with no heading block.
   */
  title?: string;
  /**
   * Short kicker label above the title (rendered with `aurora-kicker` class).
   */
  kicker?: string;
  /** Supporting line below the title. */
  subtitle?: string;
  /**
   * Number of columns in the grid.
   * Defaults to 3, which matches the existing ExampleOutputGrid default.
   */
  columns?: 2 | 3 | 4;
  /**
   * When true, a "View all in Gallery" link is rendered to the right of the
   * section heading. Defaults to false.
   */
  showGalleryLink?: boolean;
  className?: string;
};

/**
 * OutputGallery — shared example-output gallery strip.
 *
 * A thin wrapper around the existing `ExampleOutputGrid` that adds:
 *   - A standardised section header (kicker, title, subtitle)
 *   - An optional "View all in Gallery" link
 *   - Consistent vertical spacing via the component's own padding
 *
 * Insertion rules (from Task 378 audit):
 *   - /studio    : below the result card / above the existing masonry columns
 *   - /colors    : below ColorsShotsGallery (around line 628)
 *   - /lipsync   : below LipSyncModeSwitcher, above or below the form
 *   - /spin      : just before the prompt <form>
 *   - /ugc       : between the preset scene picker and the inline generator
 *   - /ugc-line  : replaces the empty-state placeholder in the queue panel
 *
 * DO NOT render inside: /canvas (full-screen ReactFlow editor).
 *
 * This component intentionally delegates all grid rendering to ExampleOutputGrid
 * so there is one source of truth for cell animation, hover effects, and
 * Ken Burns treatment.
 */
export function OutputGallery({
  items,
  title,
  kicker,
  subtitle,
  columns = 3,
  showGalleryLink = false,
  className,
}: OutputGalleryProps) {
  const hasHeader = kicker || title || subtitle;
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<DemoMediaAsset | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setExpanded(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  return (
    <section
      aria-label={title ?? "Example outputs"}
      className={cn("py-6 aurora-output-gallery", className)}
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {kicker && <p className="aurora-kicker mb-1">{kicker}</p>}
            {title && (
              <h2 className="text-base md:text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>

          {showGalleryLink && (
            <Link
              to="/gallery"
              className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              aria-label="View all outputs in the gallery"
            >
              View all
              <ArrowRight className="size-3" />
            </Link>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="aurora-output-toggle"
        aria-expanded={expanded}
      >
        {expanded ? "Hide examples" : `View ${items.length} real examples`}
      </button>

      {expanded && (
        <div
          className="aurora-output-grid mt-4"
          data-columns={columns}
        >
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item)}
              className="aurora-output-tile group"
              aria-label={`Open ${item.alt}`}
              style={{ transitionDelay: `${index * 75}ms` }}
            >
              <DemoMedia asset={item} />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-3 pb-3 pt-10 text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">
                {item.label ?? "Aurora output"}
              </span>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={active.alt}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActive(null);
          }}
        >
          <div className="relative max-h-full w-full max-w-5xl">
            <button
              type="button"
              autoFocus
              onClick={() => setActive(null)}
              className="absolute right-2 top-2 z-10 inline-flex size-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition-colors hover:bg-white/15"
              aria-label="Close full-screen example"
            >
              <X className="size-5" />
            </button>
            <DemoMedia asset={active} controls={active.type === "video"} priority className="max-h-[82vh] rounded-2xl object-contain" />
            <p className="mt-3 text-center text-sm text-white/80">{active.alt}</p>
          </div>
        </div>
      )}
    </section>
  );
}
