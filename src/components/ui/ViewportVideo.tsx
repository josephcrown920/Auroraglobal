import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Lazy, viewport-aware video for operator review.
 *
 * The poster is rendered during SSR and until the card is near the viewport.
 * Once mounted, the video always remains available with native controls and
 * manual play; reduced-motion preferences therefore avoid autoplay without
 * hiding the reviewable media.
 */
export function ViewportVideo({
  src,
  poster,
  alt,
  className,
}: {
  src: string;
  poster: string;
  alt: string;
  className?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    setMounted(true);
    const element = wrapperRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={wrapperRef} className={cn("relative overflow-hidden bg-black", className)}>
      <img src={poster} alt={alt} loading="lazy" className="absolute inset-0 size-full object-cover" />
      {mounted && inView && (
        <video
          src={src}
          poster={poster}
          controls
          autoPlay={false}
          playsInline
          preload="metadata"
          aria-label={alt}
          className="absolute inset-0 size-full object-contain"
        />
      )}
    </div>
  );
}