import { useEffect, useState } from "react";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { getColorStudio } from "@/lib/colors.studios";
import { cn } from "@/lib/utils";

/** Tracks the user's `prefers-reduced-motion` setting (SSR-safe). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

type Props = {
  /** Color preset id (e.g. "royal-blue"). */
  colorId: string;
  /** Accessible label / alt text for the studio. */
  label?: string;
  className?: string;
  /** Hint the browser how aggressively to fetch the clip. Defaults to "metadata". */
  preload?: "none" | "metadata" | "auto";
};

/**
 * A real, per-color COLORS-style studio environment that animates with subtle
 * looping motion (drifting haze + gentle light shift). Plays a muted, looping,
 * autoplaying clip with its matched first-frame poster; reduced-motion users get
 * the static poster still instead of the video.
 */
export function ColorStudioBackdrop({
  colorId,
  label = "Studio",
  className,
  preload = "metadata",
}: Props) {
  const reduced = usePrefersReducedMotion();
  const studio = getColorStudio(colorId);

  if (reduced) {
    return (
      <img
        src={studio.poster}
        alt={label}
        loading="lazy"
        className={cn("absolute inset-0 size-full object-cover", className)}
      />
    );
  }

  return (
    <AutoplayVideo
      key={studio.loop}
      src={studio.loop}
      poster={studio.poster}
      loop
      playsInline
      preload={preload}
      aria-label={label}
      className={cn("absolute inset-0 size-full object-cover", className)}
    />
  );
}
