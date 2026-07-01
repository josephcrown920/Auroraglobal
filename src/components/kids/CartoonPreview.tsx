import { useEffect, useRef, useState } from "react";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { cn } from "@/lib/utils";

/**
 * A looping cartoon preview used in the Kids Story Studio.
 *
 * Renders the static `poster` as the base layer (so something paints instantly
 * and during SSR), then lazily mounts a muted, looping <video> on top once the
 * element scrolls into view on the client. The poster doubles as the
 * reduced-motion fallback: when the user prefers reduced motion the video is
 * never mounted and only the still image is shown.
 *
 * SSR-safe: the server and the first client render emit identical markup (just
 * the <img>), so there is no hydration mismatch — the <video> is only added
 * after mount.
 */
export function CartoonPreview({
  src,
  poster,
  alt,
  className,
  rounded = "rounded-xl",
}: {
  src: string;
  poster: string;
  alt: string;
  className?: string;
  rounded?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq) {
      setReducedMotion(mq.matches);
      const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mq.addEventListener?.("change", onChange);
      return () => mq.removeEventListener?.("change", onChange);
    }
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const showVideo = mounted && inView && !reducedMotion;

  return (
    <div ref={wrapRef} className={cn("relative overflow-hidden bg-card/40", rounded, className)}>
      <img
        src={poster}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 size-full object-cover"
      />
      {showVideo && (
        <AutoplayVideo
          src={src}
          poster={poster}
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}
