import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  alt: string;
  className?: string;
};

/** Draggable before/after reveal. Auto-sweeps once when it enters the viewport. */
export function BeforeAfter({
  before,
  after,
  beforeLabel = "Source",
  afterLabel = "Rendered",
  alt,
  className = "",
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(52);
  const [dragging, setDragging] = useState(false);
  const [swept, setSwept] = useState(false);

  const move = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const next = ((clientX - r.left) / r.width) * 100;
    setPos(Math.min(98, Math.max(2, next)));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => move(e.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, move]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || swept) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setSwept(true);
        const start = performance.now();
        const tick = (t: number) => {
          const k = Math.min(1, (t - start) / 1600);
          const eased = 1 - Math.pow(1 - k, 3);
          setPos(52 + Math.sin(eased * Math.PI) * 34);
          if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [swept]);

  return (
    <div
      ref={wrapRef}
      className={`group relative touch-none overflow-hidden rounded-2xl border border-border bg-card select-none ${className}`}
      onPointerDown={(e) => {
        setDragging(true);
        move(e.clientX);
      }}
    >
      <img
        src={after}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
      />
      <div
        className="absolute inset-0 overflow-hidden transition-transform duration-700 group-hover:scale-[1.02]"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img src={before} alt="" aria-hidden loading="lazy" className="h-full w-full object-cover" />
      </div>

      <span className="label-chip absolute top-3 left-3 z-10">{beforeLabel}</span>
      <span className="label-chip absolute top-3 right-3 z-10">{afterLabel}</span>

      <div
        className="absolute inset-y-0 z-10 w-px bg-foreground/80"
        style={{ left: `${pos}%` }}
        aria-hidden
      >
        <span className="btn-aurora absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-xs font-bold shadow-[var(--shadow-glow)]">
          ‹ ›
        </span>
      </div>

      <input
        type="range"
        min={2}
        max={98}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label={`${alt} — drag to compare`}
        className="absolute inset-x-0 bottom-0 z-20 h-8 w-full cursor-ew-resize opacity-0"
      />
    </div>
  );
}
