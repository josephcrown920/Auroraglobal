import { useEffect, useState } from "react";
import { X, Sparkles, Zap, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasDismissedTour, hasCompletedFirstGen, markTourDismissed } from "@/lib/first-run";

const STUDIO_STEPS = [
  {
    icon: Sparkles,
    title: "Add your references",
    body: "Use the settings button beside the prompt bar to add your selfie, outfit, scene, or prop references.",
    color: "text-primary",
  },
  {
    icon: Zap,
    title: "Describe the shot",
    body: "Write your idea in the bottom prompt bar, then tap the purple Generate button when it looks right.",
    color: "text-amber-400",
  },
  {
    icon: Eye,
    title: "Watch the canvas",
    body: "Your finished shot appears in the canvas. From there you can open the gallery, animate it, or make another angle.",
    color: "text-emerald-400",
  },
] as const;

const GENERIC_STEPS = [
  {
    icon: Sparkles,
    title: "Start with an idea",
    body: "Use the examples or enter your own direction to get started quickly.",
    color: "text-primary",
  },
  {
    icon: Zap,
    title: "Choose your settings",
    body: "Pick the inputs and options that fit what you want to create.",
    color: "text-amber-400",
  },
  {
    icon: Eye,
    title: "Review your result",
    body: "When it is ready, preview the result, download it, or create another version.",
    color: "text-emerald-400",
  },
] as const;

type Props = {
  show: boolean;
  onDismiss?: () => void;
  variant?: "studio" | "generic";
};

export function WelcomeTour({ show, onDismiss, variant = "generic" }: Props) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const steps = variant === "studio" ? STUDIO_STEPS : GENERIC_STEPS;

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
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  if (!mounted) return null;

  const current = steps[step];
  const Icon = current.icon;

  return (
    <div
      className={cn(
        "fixed bottom-60 left-0 right-0 z-50 px-4 transition-all duration-400",
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
            {steps.map((_, i) => (
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
            {step < steps.length - 1 ? "Next →" : "Got it ✓"}
          </button>
        </div>
      </div>
    </div>
  );
}
