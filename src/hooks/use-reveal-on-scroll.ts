import { useEffect, useRef } from "react";

/**
 * Adds a `data-revealed` attribute to each element matching `selector`
 * inside `containerRef` as it enters the viewport.
 *
 * Usage: pair with `.reveal-card` CSS class (opacity 0→1, translateY 20→0).
 * Respects `prefers-reduced-motion`.
 */
export function useRevealOnScroll<T extends HTMLElement>(
  containerRef: React.RefObject<T | null>,
  selector = ".reveal-card",
) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
        el.dataset.revealed = "true";
      });
      return;
    }
    const els = Array.from(root.querySelectorAll<HTMLElement>(selector));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.revealed = "true";
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [containerRef, selector]);
}
