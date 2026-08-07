import type { ReactNode } from "react";

// ── Higgsfield-style two-panel desktop layout primitives ──────────────────────
// Used by Studio, Motion Control, Directors ROOM, and Home.
// Mobile: single-column natural flow (right/hero panel hidden).
// Desktop (lg+): left controls sidebar | right hero/canvas panel, full viewport.

/**
 * HiggsPanel — outer two-column shell.
 * The sidebar slot renders on both mobile and desktop (full-width on mobile, 
 * fixed-width on desktop). The `main` slot renders only on desktop (lg+).
 */
export function HiggsPanel({
  sidebar,
  main,
  className = "",
}: {
  sidebar: ReactNode;
  main: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col min-h-screen lg:flex-row lg:h-[100dvh] lg:overflow-hidden bg-zinc-950 text-zinc-100 ${className}`}>
      {/* ── Left: controls sidebar ─────────────────────────────────────── */}
      <div className="flex flex-col w-full lg:w-[300px] lg:shrink-0 lg:h-full lg:overflow-y-auto lg:border-r lg:border-white/8 scrollbar-none">
        {sidebar}
      </div>
      {/* ── Right: hero / canvas — desktop only ────────────────────────── */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:h-full lg:overflow-y-auto scrollbar-none">
        {main}
      </div>
    </div>
  );
}

/**
 * HiggsHero — bold all-caps heading with a [bracket] accent word.
 * Matches the typography style of Higgsfield's feature pages.
 */
export function HiggsHero({
  kicker,
  lines,
  bracketWord,
  description,
  headline,
  children,
}: {
  kicker?: ReactNode;
  /** Each string is one line; include bracketWord verbatim for accent highlighting */
  lines: string[];
  /** The word to wrap in [brackets] and tint with violet */
  bracketWord?: string;
  description?: ReactNode;
  headline?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="px-10 pt-12 pb-6 xl:px-14">
      {kicker && (
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-violet-400/70 mb-4">
          {kicker}
        </p>
      )}
      <h1
        className="font-display font-black leading-[0.9] tracking-tight text-white mb-5 uppercase"
        style={{ fontSize: "clamp(2.2rem, 3.5vw, 3.4rem)" }}
      >
        {headline ?? lines.map((line, i) => {
          if (!bracketWord || !line.includes(bracketWord)) {
            return (
              <span key={i} className="block">
                {line}
              </span>
            );
          }
          const idx = line.indexOf(bracketWord);
          return (
            <span key={i} className="block">
              {line.slice(0, idx)}
              <span className="text-violet-400">[{bracketWord}]</span>
              {line.slice(idx + bracketWord.length)}
            </span>
          );
        })}
      </h1>
      {description && (
        <p className="text-[15px] leading-relaxed text-zinc-400 max-w-[400px] mb-8">
          {description}
        </p>
      )}
      {children}
    </div>
  );
}

/**
 * StepGuide — "How it works" row of 3 flat cards.
 */
export interface GuideStep {
  icon: ReactNode;
  title: string;
  description: string;
}

export function StepGuide({
  steps,
  label = "HOW IT WORKS",
}: {
  steps: GuideStep[];
  label?: string;
}) {
  return (
    <div className="px-10 pb-8 xl:px-14">
      {label && (
        <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-zinc-500 mb-4">
          {label}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 hover:bg-white/[0.05] hover:border-white/15 transition-colors"
          >
            <div className="size-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
              {step.icon}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white mb-1.5">
                {step.title}
              </p>
              <p className="text-[11.5px] text-zinc-500 leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * FanPhotos — three images in a rotated fan arrangement.
 */
export function FanPhotos({
  photos,
}: {
  photos: { src: string; alt: string }[];
}) {
  const rots = [-7, 0, 7];
  const tz = ["-translate-x-10 translate-y-3", "", "translate-x-10 translate-y-3"];
  const zs = [1, 3, 2];
  return (
    <div className="relative flex items-end justify-center h-64 my-4 select-none">
      {photos.slice(0, 3).map((p, i) => (
        <div
          key={p.src}
          className={`absolute w-40 aspect-[3/4] rounded-2xl overflow-hidden border-2 border-white/15 shadow-2xl shadow-black/70 ${tz[i]}`}
          style={{
            transform: `rotate(${rots[i]}deg)`,
            zIndex: zs[i],
          }}
        >
          <img
            src={p.src}
            alt={p.alt}
            className="w-full h-full object-cover"
            loading="lazy"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * HiggsDivider — thin horizontal rule with label.
 */
export function HiggsDivider({ label }: { label: ReactNode }) {
  return (
    <div className="px-10 xl:px-14 pb-5 flex items-center gap-4">
      <div className="h-px flex-1 bg-white/8" />
      <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-zinc-600">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/8" />
    </div>
  );
}
