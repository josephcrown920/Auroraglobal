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
        className="relative w-full max-w-md rounded-3xl border border-primary/40 bg-gradient-to-br from-[#1a0d2e] via-[#13091f] to-[#0a0613] p-8 shadow-2xl shadow-primary/60 animate-scale-in"
      >
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute top-3 right-3 size-8 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center"
        >
          <X className="size-4" />
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-primary border border-primary/40 bg-primary/15 px-3 py-1 rounded-full">
          <Sparkles className="size-3" /> Wait — before you go
        </span>
        <h3 className="mt-4 text-2xl md:text-3xl font-semibold leading-tight text-foreground">
          50% off your <span className="aurora-gradient-text">first Aura pack</span>
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Try Aurora at half price. Code applied automatically at checkout when you start in the next hour.
        </p>
        <div className="mt-4 rounded-xl border border-dashed border-primary/40 bg-primary/10 px-4 py-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Promo code</span>
          <span className="font-mono text-lg font-semibold text-primary">{CODE}</span>
        </div>
        <Link
          to="/"
          hash="pricing"
          onClick={() => {
            try {
              localStorage.setItem("aurora_promo", CODE);
            } catch {
              // localStorage unavailable (e.g. private browsing) — non-fatal
            }
            void track("exit_intent_claim");
            setOpen(false);
          }}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-medium text-primary-foreground bg-[image:var(--gradient-hero)] hover:opacity-95 shadow-xl shadow-primary/30 no-underline"
        >
          Claim 50% off <ArrowRight className="size-4" />
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground/70"
        >
          No thanks, I'll pay full price later
        </button>
      </div>
    </div>
  );
}
