import { cn } from "@/lib/utils";

interface GenerationProgressProps {
  progress: number;
  label?: string;
  visible: boolean;
  className?: string;
  /** Use aurora gradient fill instead of primary color */
  gradient?: boolean;
}

/**
 * Reusable progress bar for generation flows.
 * Accepts a 0–100 value and an optional status label.
 * Styled to match the Aurora premium design system.
 */
export function GenerationProgress({
  progress,
  label,
  visible,
  className,
  gradient = true,
}: GenerationProgressProps) {
  if (!visible) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-1.5 rounded-full bg-primary animate-pulse"
              aria-hidden
            />
            {label}
          </span>
          <span className="tabular-nums font-medium text-foreground/70">
            {progress}%
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-primary/15"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            gradient
              ? "bg-[image:var(--gradient-hero)]"
              : "bg-primary",
          )}
          style={{ width: `${Math.max(2, progress)}%` }}
        />
        {/* Shimmer sweep */}
        {progress < 100 && (
          <div
            className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_1.6s_ease-in-out_infinite]"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
