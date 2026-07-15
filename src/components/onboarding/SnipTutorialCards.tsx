import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

const STORAGE_KEY = "aurora.snip.dismissed.v2";

type Step = {
  emoji: string;
  title: string;
  body: string;
  cta: string;
  to?: string;
};

const STEPS: Step[] = [
  {
    emoji: "👋",
    title: "Welcome to Aurora",
    body: "Turn any selfie into cinematic shots, music videos, and lip-synced performances in seconds. Let's walk you through it.",
    cta: "Show me how →",
  },
  {
    emoji: "📸",
    title: "Upload your photo",
    body: "In the Studio, tap the photo panel on the left to upload your selfie. This becomes your identity for every shot.",
    cta: "Got it",
  },
  {
    emoji: "✍️",
    title: "Describe your vibe",
    body: "Type a creative direction — or tap one of the example chips to auto-fill a proven cinematic prompt. No prompting skills needed.",
    cta: "Makes sense",
  },
  {
    emoji: "⚡",
    title: "Hit Generate",
    body: "One tap sends your photo to the AI. Your result appears in 10–30 seconds. Try different models for different looks.",
    cta: "Easy enough",
  },
  {
    emoji: "🎤",
    title: "Add lip-sync",
    body: "Drop your audio file into the Lip Sync tool and Aurora animates your photo to match every word. Perfect for music artists.",
    cta: "Sounds good",
  },
  {
    emoji: "🚀",
    title: "Go viral with TikTok30",
    body: "TikTok30 batches 30 content posts in one session — the fastest path to growing your page. Ready to try it?",
    cta: "Open TikTok30",
    to: "/spin",
  },
];

type Props = {
  show?: boolean;
  forceShow?: boolean;
  onDismiss?: () => void;
};

export function SnipTutorialCards({ show = true, forceShow = false, onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!show && !forceShow) return;
    if (typeof window === "undefined") return;
    if (!forceShow) {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch {
        return;
      }
    }
    setMounted(true);
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, [show, forceShow]);

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* non-fatal */ }
    setTimeout(() => setMounted(false), 400);
    onDismiss?.();
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  if (!mounted) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] w-[calc(100vw-2rem)] max-w-md transition-all duration-500",
        visible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0 pointer-events-none",
      )}
      role="dialog"
      aria-label="Aurora tutorial"
    >
      <div className="relative rounded-2xl border border-white/15 bg-[#0d0a1e]/95 backdrop-blur-xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Red top accent strip */}
        <div className="h-0.5 bg-gradient-to-r from-red-500 via-pink-500 to-primary" />

        <div className="p-4 flex items-start gap-3">
          {/* Avatar */}
          <div className="shrink-0 size-10 rounded-xl overflow-hidden border border-white/20 bg-black flex items-center justify-center">
            <img src={auroraLogo.url} alt="Aurora" className="size-8 object-contain" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
                {current.emoji} Step {step + 1} of {STEPS.length}
              </p>
              <button
                onClick={dismiss}
                className="shrink-0 size-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Dismiss tutorial"
              >
                <X className="size-3 text-white/60" />
              </button>
            </div>
            <p className="text-sm font-semibold text-white leading-snug">{current.title}</p>
            <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{current.body}</p>

            {/* Progress dots */}
            <div className="flex items-center gap-1 mt-2.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === step ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-white/25 hover:bg-white/40",
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 px-4 pb-4 pt-1">
          <button
            onClick={prev}
            disabled={step === 0}
            className="size-8 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center transition-colors"
            aria-label="Previous step"
          >
            <ChevronLeft className="size-4 text-white/70" />
          </button>
          <button
            onClick={next}
            disabled={step === STEPS.length - 1}
            className="size-8 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-30 flex items-center justify-center transition-colors"
            aria-label="Next step"
          >
            <ChevronRight className="size-4 text-white/70" />
          </button>
          <div className="flex-1" />
          {isLast && current.to ? (
            <Link
              to={current.to}
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-red-500 hover:bg-red-400 text-white no-underline transition-colors"
            >
              {current.cta} <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <button
              onClick={isLast ? dismiss : next}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-primary hover:brightness-110 text-primary-foreground transition-colors"
            >
              {isLast ? "Finish tour" : current.cta}
              {!isLast && <ArrowRight className="size-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
