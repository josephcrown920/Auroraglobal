import { Clock, Film, ChevronRight, ChevronLeft, AlertCircle } from "lucide-react";
import type { VideoShot } from "@/lib/video-agent-skills";
import { cn } from "@/lib/utils";
import { useRef } from "react";

const PURPOSE_DOT: Record<string, string> = {
  establishing: "bg-sky-400",
  context:      "bg-blue-400",
  character:    "bg-violet-400",
  reaction:     "bg-fuchsia-400",
  detail:       "bg-amber-400",
  insert:       "bg-orange-400",
  payoff:       "bg-emerald-400",
};

type SequenceBarProps = {
  shots: VideoShot[];
  selectedIndex: number;
  onSelectShot: (index: number) => void;
  format: string;
};

export function SequenceBar({ shots, selectedIndex, onSelectShot, format }: SequenceBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalDuration = shots.reduce((sum, s) => sum + (s.duration_s ?? 0), 0);
  const continuityBreaks = shots.filter((s, i) => i > 0 && !s.chain_from).length;
  const hasAllPlates = shots.every((s) => s.starting_frame_hint);

  function scrollBy(direction: "left" | "right") {
    scrollRef.current?.scrollBy({ left: direction === "right" ? 200 : -200, behavior: "smooth" });
  }

  return (
    <div className="previs-sequence-bar">
      {/* Stats row */}
      <div className="previs-sequence-stats">
        <div className="previs-stat">
          <Film className="size-3 text-ink-dim/50" />
          <span>{shots.length} shots</span>
        </div>
        <div className="previs-stat">
          <Clock className="size-3 text-ink-dim/50" />
          <span>{totalDuration.toFixed(0)}s total</span>
        </div>
        <div className="previs-stat">
          <span className="text-ink-dim/50">{format}</span>
        </div>
        {continuityBreaks > 0 && (
          <div className="previs-stat previs-stat--warn">
            <AlertCircle className="size-3 text-amber-400" />
            <span>{continuityBreaks} continuity gaps</span>
          </div>
        )}
      </div>

      {/* Timeline scroll */}
      <div className="previs-sequence-scroll-wrap">
        <button
          type="button"
          onClick={() => scrollBy("left")}
          className="previs-sequence-scroll-btn previs-sequence-scroll-btn--left"
          aria-label="Scroll sequence left"
        >
          <ChevronLeft className="size-3.5" />
        </button>

        <div ref={scrollRef} className="previs-sequence-timeline no-scrollbar">
          {shots.map((shot, i) => {
            const widthPct = totalDuration > 0 ? (shot.duration_s / totalDuration) * 100 : 100 / shots.length;
            const isSelected = selectedIndex === i;
            return (
              <button
                key={shot.id}
                type="button"
                onClick={() => onSelectShot(i)}
                aria-pressed={isSelected}
                aria-label={`Shot ${i + 1}: ${shot.purpose} — ${shot.duration_s}s`}
                className={cn("previs-timeline-shot", isSelected && "previs-timeline-shot--active")}
                style={{ minWidth: `${Math.max(widthPct, 8)}%` }}
              >
                {/* Color bar */}
                <span
                  className={cn("previs-timeline-bar", PURPOSE_DOT[shot.purpose] ?? "bg-ink-dim/30", isSelected && "opacity-100")}
                />
                {/* Shot num */}
                <span className="previs-timeline-num">{String(i + 1).padStart(2, "0")}</span>
                {/* Purpose */}
                <span className="previs-timeline-purpose">{shot.purpose}</span>
                {/* Duration */}
                <span className="previs-timeline-dur">{shot.duration_s}s</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollBy("right")}
          className="previs-sequence-scroll-btn previs-sequence-scroll-btn--right"
          aria-label="Scroll sequence right"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
