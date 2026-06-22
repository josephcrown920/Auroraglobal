import { useEffect, useState } from "react";
import { track } from "@/lib/tracking";

const MILESTONES = [25, 50, 75, 100];

export function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const fired = new Set<number>();
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const p = max > 0 ? (h.scrollTop / max) * 100 : 0;
      setPct(p);
      for (const m of MILESTONES) {
        if (p >= m && !fired.has(m)) {
          fired.add(m);
          void track("scroll_depth", { pct: m });
        }
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed top-0 inset-x-0 z-[55] h-0.5 bg-transparent pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-300 transition-[width] duration-100"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
