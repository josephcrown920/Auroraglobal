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
 * looping motion (drifting haze + gentle light shift).
 *
 * The photoreal poster still is ALWAYS painted as a real <img> layer, so the
 * studio set is visible instantly and stays visible even when the clip can't
 * load or autoplay (slow connections, strict mobile autoplay policies). The
 * looping clip fades in on top only once it is actually playing. Reduced-motion
 * users get just the still.
 */
export function ColorStudioBackdrop({
  colorId,
  label = "Studio",
  className,
  preload = "metadata",
}: Props) {
  const reduced = usePrefersReducedMotion();
  const studio = getColorStudio(colorId);
  const [playing, setPlaying] = useState(false);

  // Switching colors swaps the clip — drop back to the poster until the new
  // clip actually paints.
  useEffect(() => setPlaying(false), [studio.loop]);

  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <img
        src={studio.poster}
        alt={label}
        className="absolute inset-0 size-full object-cover"
      />
      {!reduced && (
        <AutoplayVideo
          key={studio.loop}
          src={studio.loop}
          poster={studio.poster}
          loop
          playsInline
          preload={preload}
          aria-hidden
          onPlaying={() => setPlaying(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-500",
            playing ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
