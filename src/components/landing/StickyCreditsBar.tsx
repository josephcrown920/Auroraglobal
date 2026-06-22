import { useEffect, useState } from "react";
import { Sparkles, X, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { track } from "@/lib/tracking";

const KEY = "aurora_sticky_dismissed_at";
const DURATION_MS = 1000 * 60 * 60 * 24; // 24h offer

function fmt(ms: number) {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function StickyCreditsBar() {
  const [visible, setVisible] = useState(false);
  const [nearBottom, setNearBottom] = useState(false);
  const [remaining, setRemaining] = useState(DURATION_MS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(KEY);
    if (dismissed && Date.now() - Number(dismissed) < DURATION_MS) return;
    let start = Number(localStorage.getItem("aurora_offer_start"));
    if (!start || Date.now() - start > DURATION_MS) {
      start = Date.now();
      localStorage.setItem("aurora_offer_start", String(start));
    }
    const tick = () => setRemaining(start + DURATION_MS - Date.now());
    tick();
    const t = setTimeout(() => setVisible(true), 4000);
    const i = setInterval(tick, 1000);
    const onScroll = () => {
      const fromBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      setNearBottom(fromBottom < 220);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { clearTimeout(t); clearInterval(i); window.removeEventListener("scroll", onScroll); };
  }, []);

  if (!visible || nearBottom) return null;


  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pointer-events-none animate-fade-in">
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-violet-400/40 bg-gradient-to-r from-violet-600/95 via-fuchsia-600/95 to-violet-600/95 backdrop-blur-xl shadow-2xl shadow-violet-900/50 px-4 py-3 flex items-center gap-3">
        <span className="size-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <Zap className="size-4 text-white" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            First Aurora pack — extra 25% Aurora free.
          </p>
          <p className="text-[11px] text-white/80 truncate font-mono">
            Ends in {fmt(remaining)} · code applied automatically
          </p>
        </div>
        <Link
          to="/"
          hash="pricing"
          onClick={() => void track("sticky_bar_cta_click")}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white text-violet-700 text-sm font-semibold hover:bg-white/95 shrink-0 no-underline"
        >
          <Sparkles className="size-3.5" /> Claim
        </Link>
        <button
          onClick={() => {
            localStorage.setItem(KEY, String(Date.now()));
            setVisible(false);
            void track("sticky_bar_dismiss");
          }}
          aria-label="Dismiss"
          className="size-7 rounded-full hover:bg-white/15 text-white/80 hover:text-white flex items-center justify-center shrink-0"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
