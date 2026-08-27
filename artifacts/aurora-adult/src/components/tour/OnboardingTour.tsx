// Full-screen dimmed overlay + bottom step card driving the 15-step tour.
// App.tsx owns navigation: it renders this on top of whichever view the
// current step needs and calls onNavigate before advancing.
import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, X } from "lucide-react";
import { TOUR_STEPS, type TourView } from "./tourSteps";

interface Props {
  stepIndex: number;
  onNavigate: (view: TourView) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function OnboardingTour({ stepIndex, onNavigate, onNext, onBack, onSkip }: Props) {
  const step = TOUR_STEPS[stepIndex];
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    onNavigate(step.view);
  }, [step.view, onNavigate]);

  useEffect(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    }, 60);
    return () => clearTimeout(t);
  }, [step.target, step.view, stepIndex]);

  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px]" />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-2xl ring-2 ring-rose-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-all duration-300"
          style={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
        />
      )}

      <div className="absolute inset-x-0 bottom-6 z-10 mx-auto flex w-[92%] max-w-md flex-col gap-3 rounded-2xl border border-white/10 bg-[#110a14] p-5 shadow-2xl shadow-black/60 animate-float-in sm:bottom-10">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
            Step {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <button onClick={onSkip} className="text-white/30 hover:text-white" title="Skip tour">
            <X size={14} />
          </button>
        </div>
        <h3 className="text-[16px] font-bold text-white">{step.title}</h3>
        <p className="text-[13px] leading-relaxed text-white/60">{step.body}</p>

        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-fuchsia-500 transition-all"
            style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="mt-1 flex items-center justify-between">
          <button onClick={onSkip} className="text-[11px] font-semibold text-white/40 hover:text-white">
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/70 hover:text-white"
              >
                <ArrowLeft size={11} /> Back
              </button>
            )}
            <button
              onClick={onNext}
              className="flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-600 to-pink-600 px-3.5 py-1.5 text-[11px] font-bold text-white"
            >
              {isLast ? "Done" : "Next"} {!isLast && <ArrowRight size={11} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
