import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

type IntroAnimationProps = {
  onDone: () => void;
};

const FIRST_LINE = "Some people get to their perfect destination…";
const SECOND_LINE = "Glad you made it to Aurora.";

export function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;

  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  return query.media === "(prefers-reduced-motion: reduce)" && query.matches;
}

const wordVariants = {
  hidden: { opacity: 0, y: 12, filter: "blur(5px)" },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      delay: 0.9 + index * 0.055,
      duration: 0.65,
        ease: [0.22, 1, 0.36, 1] as const,
    },
  }),
};

function AnimatedLine({
  text,
  startIndex,
  className,
}: {
  text: string;
  startIndex: number;
  className?: string;
}) {
  return (
    <p className={className}>
      {text.split(" ").map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          custom={startIndex + index}
          variants={wordVariants}
          initial="hidden"
          animate="visible"
          className="mr-[0.28em] inline-block last:mr-0"
        >
          {word}
        </motion.span>
      ))}
    </p>
  );
}

export function IntroAnimation({ onDone }: IntroAnimationProps) {
  const [closing, setClosing] = useState(false);
  const finishedRef = useRef(false);

  const beginClose = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setClosing(true);
  }, []);

  const finishImmediately = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      finishImmediately();
      return;
    }

    const timer = window.setTimeout(beginClose, 5200);
    return () => window.clearTimeout(timer);
  }, [beginClose, finishImmediately]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Aurora"
      initial={{ opacity: 1 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: 0.72, ease: [0.76, 0, 0.24, 1] as const }}
      onAnimationComplete={() => {
        if (closing) onDone();
      }}
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-hidden bg-[oklch(0.085_0.022_272)] text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, oklch(0.24 0.11 292 / 0.24), transparent 34%), radial-gradient(circle at 50% 100%, oklch(0.16 0.08 272 / 0.32), transparent 48%)",
        }}
      />

      <div className="relative flex w-full max-w-2xl flex-col items-center px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.72, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12"
        >
          <img
            src={auroraLogo.url}
            alt="Aurora"
            className="h-auto w-[min(17rem,62vw)] object-contain"
          />
        </motion.div>

        <div className="font-display text-[clamp(1.35rem,4vw,2.25rem)] leading-[1.16] tracking-[-0.035em]">
          <AnimatedLine
            text={FIRST_LINE}
            startIndex={0}
            className="font-light text-white/65"
          />
          <AnimatedLine
            text={SECOND_LINE}
            startIndex={9}
            className="mt-3 font-medium text-white"
          />
        </div>

        <motion.button
          type="button"
          onClick={beginClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: closing ? 0 : 1 }}
          transition={{ delay: 4.15, duration: 0.7 }}
          className="mt-14 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45 transition-colors hover:border-violet-300/50 hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80"
        >
          Continue
        </motion.button>
      </div>

      <button
        type="button"
        onClick={beginClose}
        aria-label="Skip Aurora intro"
        className="absolute right-5 top-5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80 sm:right-8 sm:top-8"
      >
        Skip
      </button>
    </motion.div>
  );
}