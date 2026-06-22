import { useEffect, useState } from "react";
import { X, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { track } from "@/lib/tracking";

const KEY = "aurora_exit_intent_seen";
const CODE = "AURORA50";

export function ExitIntentModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;

    const mountedAt = Date.now();
    const MIN_DWELL_MS = 10_000;
    let triggered = false;
    const fire = () => {
      if (triggered) return;
      if (Date.now() - mountedAt < MIN_DWELL_MS) return;
      triggered = true;
      localStorage.setItem(KEY, "1");
      setOpen(true);
      void track("exit_intent_shown");
    };

    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) fire();
    };
    const isTouch = matchMedia("(pointer: coarse)").matches;
    let lastY = window.scrollY;
    let maxY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y > maxY) maxY = y;
      // Mobile: only after user has scrolled deep, then quickly scrolls up
      if (isTouch && maxY > 800 && lastY - y > 120) fire();
      lastY = y;
    };

    document.addEventListener("mouseout", onMouseOut);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);


  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl border border-violet-400/40 bg-gradient-to-br from-[#1a0d2e] via-[#13091f] to-[#0a0613] p-8 shadow-2xl shadow-violet-900/60 animate-scale-in"
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute top-3 right-3 size-8 rounded-full hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center"
        >
          <X className="size-4" />
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-violet-200 border border-violet-400/40 bg-violet-500/15 px-3 py-1 rounded-full">
          <Sparkles className="size-3" /> Wait — before you go
        </span>
        <h3 className="mt-4 text-2xl md:text-3xl font-semibold leading-tight text-white">
          50% off your <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">first credit pack</span>
        </h3>
        <p className="mt-2 text-sm text-white/70">
          Try Aurora at half price. Code applied automatically at checkout when you start in the next hour.
        </p>
        <div className="mt-4 rounded-xl border border-dashed border-violet-400/40 bg-violet-500/10 px-4 py-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Promo code</span>
          <span className="font-mono text-lg font-semibold text-violet-200">{CODE}</span>
        </div>
        <Link
          to="/"
          hash="pricing"
          onClick={() => {
            try { localStorage.setItem("aurora_promo", CODE); } catch {}
            void track("exit_intent_claim");
            setOpen(false);
          }}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-medium text-white bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-95 shadow-xl shadow-violet-500/30 no-underline"
        >
          Claim 50% off <ArrowRight className="size-4" />
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="mt-2 w-full text-xs text-white/40 hover:text-white/70"
        >
          No thanks, I'll pay full price later
        </button>
      </div>
    </div>
  );
}
