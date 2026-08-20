import { useEffect, useState } from "react";

/** Types prompts out character-by-character over a live frame. Visual proof of the brief → render loop. */
export function PromptTicker({ prompts, className = "" }: { prompts: string[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [len, setLen] = useState(0);
  const [erasing, setErasing] = useState(false);
  const full = prompts[index % prompts.length] ?? "";

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLen(full.length);
      return;
    }
    const done = len >= full.length;
    const delay = erasing ? 18 : done ? 1500 : 34;
    const t = setTimeout(() => {
      if (erasing) {
        if (len === 0) {
          setErasing(false);
          setIndex((i) => i + 1);
        } else setLen((l) => l - 1);
      } else if (done) setErasing(true);
      else setLen((l) => l + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [len, erasing, full, index]);

  return (
    <div
      className={`flex items-center gap-3 rounded-full bg-background/85 px-4 py-3 text-sm backdrop-blur ${className}`}
    >
      <span className="text-accent">+</span>
      <span className="truncate font-[family-name:var(--font-mono-ui)] text-xs text-foreground">
        {full.slice(0, len)}
        <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-accent" />
      </span>
      <span className="btn-aurora ml-auto grid size-7 shrink-0 place-items-center rounded-full">✦</span>
    </div>
  );
}
