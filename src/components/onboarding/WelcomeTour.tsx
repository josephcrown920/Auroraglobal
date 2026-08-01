import { useEffect, useState } from "react";
import { X, Sparkles, Zap, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasDismissedTour, hasCompletedFirstGen, markTourDismissed } from "@/lib/first-run";

const STEPS = [
  {
    icon: Sparkles,
    title: "Pick your style",
    body: "Tap one of the example chips above — it loads a proven prompt so you start with something great.",
    color: "text-primary",
  },
  {
    icon: Zap,
    title: "Hit Generate",
    body: "One tap sends your job to the AI. No settings to dig through first.",
    color: "text-amber-400",
  },
  {
    icon: Eye,
    title: "Your result appears here",
    body: "Results land below in seconds. Download, remix, or keep going.",
    color: "text-emerald-400",
  },
] as const;

type Props = {
  show: boolean;
  onDismiss?: () => void;
};

export function WelcomeTour({ show, onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!show) return;
    if (typeof window === "undefined") return;
    if (hasDismissedTour()) return;
    if (hasCompletedFirstGen()) return;
    setMounted(true);
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, [show]);

  const dismiss = () => {
    setVisible(false);
    markTourDismissed();
    onDismiss?.();
    setTimeout(() => setMounted(false), 400);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  if (!mounted) return null;

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <div
      className={cn(
        "fixed bottom-36 left-0 right-0 z-50 px-4 transition-all duration-400",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
    >
      <div className="max-w-sm mx-auto aurora-glass-strong rounded-2xl border border-white/10 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={cn(
                "shrink-0 mt-0.5 size-7 rounded-full flex items-center justify-center",
                "bg-white/5 border border-white/10",
              )}
            >
              <Icon className={cn("size-3.5", current.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-snug">{current.title}</p>
              <p className="mt-0.5 text-xs text-white/60 leading-relaxed">{current.body}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 text-white/30 hover:text-white/70 transition-colors mt-0.5"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === step ? "w-4 bg-primary" : "w-1.5 bg-white/20",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {step < STEPS.length - 1 ? "Next →" : "Got it ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}
