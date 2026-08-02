import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";

export function BeforeAfter({ beforeSrc, afterSrc }: { beforeSrc: string; afterSrc: string }) {
  const [pct, setPct] = useState(50);
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
      <img src={beforeSrc} alt="Original scene" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        <img src={afterSrc} alt="Clean plate" className="h-full w-full max-w-none object-cover" style={{ width: `${100 / Math.max(pct, 1) * 100}%` }} />
      </div>
      <div className="absolute inset-y-0 border-l-2 border-white" style={{ left: `${pct}%` }}>
        <button aria-label="Move comparison slider" className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg" onPointerDown={(event) => {
          const move = (e: PointerEvent) => {
            const rect = event.currentTarget instanceof HTMLElement ? event.currentTarget.parentElement?.parentElement?.getBoundingClientRect() : null;
            if (rect) setPct(Math.max(1, Math.min(99, (e.clientX - rect.left) / rect.width * 100)));
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", () => window.removeEventListener("pointermove", move), { once: true });
        }}><ArrowLeftRight className="size-4" /></button>
      </div>
      <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-[10px] uppercase tracking-widest">Original</span>
      <span className="absolute bottom-3 right-3 rounded bg-black/60 px-2 py-1 text-[10px] uppercase tracking-widest">Clean plate</span>
    </div>
  );
}