import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

/**
 * Media-dominant feature card: the visual demonstration always renders ABOVE
 * the copy, and the copy is limited to a chip + title + one line.
 */
export function FeatureShowcase({
  chip,
  title,
  line,
  media,
  delay = 0,
  className = "",
}: {
  chip: string;
  title: ReactNode;
  line: string;
  media: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <Reveal
      as="figure"
      delay={delay}
      className={`group glow-frame relative flex flex-col bg-card transition-transform duration-500 hover:-translate-y-1 ${className}`}
    >
      <div className="relative aspect-16/10 w-full overflow-hidden bg-secondary">{media}</div>
      <figcaption className="flex flex-1 flex-col gap-2 p-5">
        <span className="font-[family-name:var(--font-mono-ui)] text-[0.6rem] tracking-[0.28em] text-accent uppercase">
          {chip}
        </span>
        <h3 className="headline text-2xl">{title}</h3>
        <p className="text-sm text-muted-foreground">{line}</p>
      </figcaption>
    </Reveal>
  );
}
