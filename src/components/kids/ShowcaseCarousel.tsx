import { useEffect, useRef, useState } from "react";
import { CartoonPreview } from "@/components/kids/CartoonPreview";
import { KIDS_STORY_SHOWCASE, type KidsShowcaseSample } from "@/lib/kids-previews";
import { cn } from "@/lib/utils";

const ROTATE_MS = 5000;
const PAGE_SIZE = 2;
const SWIPE_THRESHOLD_PX = 40;
const FADE_MS = 500;

function ShowcaseCards({ samples }: { samples: KidsShowcaseSample[] }) {
  return (
    <>
      {samples.map((s) => (
        <div key={s.id} className="relative">
          <CartoonPreview
            src={s.clip.loop}
            poster={s.clip.poster}
            alt={s.title}
            rounded="rounded-xl"
            className="aspect-[9/16] w-full"
          />
          <span className="absolute top-1.5 left-1.5 inline-flex items-center rounded-full bg-black/50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur pointer-events-none">
            Sample
          </span>
          <div className="absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 pointer-events-none">
            <p className="text-[11px] font-medium text-white leading-tight truncate">
              {s.title}
            </p>
            <p className="text-[9px] text-white/70">{s.blurb}</p>
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Rotating gallery of finished-story samples for the Kids Story Studio.
 * Cycles through KIDS_STORY_SHOWCASE two-at-a-time with a true overlapping
 * cross-fade (outgoing page fades out while the incoming page fades in on
 * top of it), either automatically or via the dots / a swipe. New samples
 * added to KIDS_STORY_SHOWCASE are picked up automatically — no changes
 * needed here. Auto-rotation and the cross-fade are both skipped when the
 * visitor prefers reduced motion; the dots remain so the gallery is still
 * fully navigable.
 */
export function KidsShowcaseCarousel() {
  const pageCount = Math.max(1, Math.ceil(KIDS_STORY_SHOWCASE.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const [prevPage, setPrevPage] = useState<number | null>(null);
  const [fadeIn, setFadeIn] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeCleanupRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const changePage = (next: number) => {
    const normalized = ((next % pageCount) + pageCount) % pageCount;
    if (normalized === page) return;

    if (fadeCleanupRef.current) clearTimeout(fadeCleanupRef.current);

    if (reducedMotion) {
      setPage(normalized);
      setPrevPage(null);
      return;
    }

    setPrevPage(page);
    setPage(normalized);
    setFadeIn(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFadeIn(true));
    });
    fadeCleanupRef.current = setTimeout(() => setPrevPage(null), FADE_MS + 50);
  };

  const restartTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (reducedMotion || pageCount <= 1) return;
    timerRef.current = setInterval(() => {
      setPage((p) => {
        const next = (p + 1) % pageCount;
        setPrevPage(p);
        setFadeIn(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setFadeIn(true));
        });
        if (fadeCleanupRef.current) clearTimeout(fadeCleanupRef.current);
        fadeCleanupRef.current = setTimeout(() => setPrevPage(null), FADE_MS + 50);
        return next;
      });
    }, ROTATE_MS);
  };

  useEffect(() => {
    restartTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (fadeCleanupRef.current) clearTimeout(fadeCleanupRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timerRef/fadeCleanupRef are stable mutable refs and don't need to be in deps; only reducedMotion/pageCount drive carousel restart
  }, [reducedMotion, pageCount]);

  const goTo = (next: number) => {
    changePage(next);
    restartTimer();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    goTo(dx < 0 ? page + 1 : page - 1);
  };

  const visible = KIDS_STORY_SHOWCASE.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const outgoing =
    prevPage !== null
      ? KIDS_STORY_SHOWCASE.slice(prevPage * PAGE_SIZE, prevPage * PAGE_SIZE + PAGE_SIZE)
      : null;

  return (
    <div className="space-y-3">
      <div
        className="relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {outgoing && (
          <div
            aria-hidden
            className="absolute inset-0 grid grid-cols-2 gap-3 transition-opacity pointer-events-none"
            style={{ transitionDuration: `${FADE_MS}ms`, opacity: fadeIn ? 0 : 1 }}
          >
            <ShowcaseCards samples={outgoing} />
          </div>
        )}
        <div
          className={cn("grid grid-cols-2 gap-3", outgoing && "transition-opacity")}
          style={outgoing ? { transitionDuration: `${FADE_MS}ms`, opacity: fadeIn ? 1 : 0 } : undefined}
        >
          <ShowcaseCards samples={visible} />
        </div>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show sample stories ${i + 1} of ${pageCount}`}
              aria-current={i === page}
              onClick={() => goTo(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === page ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
