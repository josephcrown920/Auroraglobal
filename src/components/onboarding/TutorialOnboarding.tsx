import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aurora.snip.dismissed.v3";

type Step = {
  emoji: string;
  title: string;
  body: string;
  cta: string;
  to?: string;
};

const STEPS: Step[] = [
  {
    emoji: "🎬",
    title: "Welcome to Aurora",
    body: "Turn a selfie + your phone recording into a full music video. Colors-style sets, luxury car scenes, viral lip sync — all generated with AI.",
    cta: "Show me →",
  },
  {
    emoji: "🎤",
    title: "Colors-Style Performance",
    body: "Pick a bold color. Upload your photo + a Colors reference. Aurora places you on a seamless cyclorama with a hanging vintage mic — wide angle and close-up.",
    cta: "Try this guide",
    to: "/guides/colors-style-performance",
  },
  {
    emoji: "🎬",
    title: "Music Video from 5 Photos",
    body: "Upload 5 references — your face, outfit, location, pose, and a car. Aurora composites you into a cinematic scene, then you shoot every angle from one prompt.",
    cta: "Try this guide",
    to: "/guides/one-scene-every-angle",
  },
  {
    emoji: "📱",
    title: "Phone Lip Sync Trick",
    body: "AI puts a phone with a green screen in front of your face at any location. Animate it, then drop your real performance onto the phone screen in CapCut. Looks like viral candid footage.",
    cta: "Try this guide",
    to: "/guides/phone-lipsync-performance",
  },
  {
    emoji: "⚡",
    title: "Custom Studio Shot",
    body: "Not following a guide? Just go to Studio, upload your photo, describe any vibe, and generate. Models include Nano Banana Pro, Seedance 2.0, Kling 3.0, and more.",
    cta: "Open Studio",
    to: "/studio",
  },
  {
    emoji: "✦",
    title: "See all playbooks",
    body: "Browse all guided workflows — Colors, car videos, AI artist creation, the Realism Formula, motion effects, and more. Step-by-step, no prompting skills needed.",
    cta: "Open Guides",
    to: "/guides",
  },
];

type Props = {
  show?: boolean;
  forceShow?: boolean;
  onDismiss?: () => void;
};

export function TutorialOnboarding({ show = true, forceShow = false, onDismiss }: Props) {
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
        <div className="h-0.5 bg-gradient-to-r from-primary via-fuchsia-500 to-primary" />

        <div className="p-4 flex items-start gap-3">
          <div className="shrink-0 size-10 rounded-xl overflow-hidden border border-white/20 bg-black flex items-center justify-center">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
          </div>

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
          {current.to ? (
            <Link
              to={current.to}
              onClick={isLast ? dismiss : undefined}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-primary hover:brightness-110 text-primary-foreground no-underline transition-colors"
            >
              {current.cta} <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <button
              onClick={isLast ? dismiss : next}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold bg-primary hover:brightness-110 text-primary-foreground transition-colors"
            >
              {isLast ? "Finish" : current.cta}
              {!isLast && <ArrowRight className="size-3.5" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export { TutorialOnboarding as SnipTutorialCards };
