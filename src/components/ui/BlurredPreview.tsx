import { useState } from "react";
import { cn } from "@/lib/utils";

interface BlurredPreviewProps {
  src: string | null;
  alt?: string;
  className?: string;
  /** How long the unblur transition takes in ms. Default 600. */
  transitionMs?: number;
  aspectRatio?: string;
}

/**
 * Displays an image blurred as soon as the URL is available, then fades to
 * full quality once the browser has fully loaded it. This gives an instant
 * low-res preview feeling while the hi-res decodes.
 */
export function BlurredPreview({
  src,
  alt = "Generation preview",
  className,
  transitionMs = 600,
  aspectRatio = "4/3",
}: BlurredPreviewProps) {
  const [loaded, setLoaded] = useState(false);

  if (!src) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 bg-card/40",
        className,
      )}
      style={{ aspectRatio }}
    >
      {/* Placeholder shimmer while loading */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-muted via-muted/60 to-muted" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className="w-full h-full object-cover"
        style={{
          filter: loaded ? "blur(0px)" : "blur(16px)",
          transform: loaded ? "scale(1)" : "scale(1.04)",
          transition: `filter ${transitionMs}ms ease, transform ${transitionMs}ms ease`,
          willChange: "filter, transform",
        }}
      />
    </div>
  );
}
