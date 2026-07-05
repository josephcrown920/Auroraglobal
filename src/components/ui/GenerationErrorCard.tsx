import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface GenerationErrorCardProps {
  error: string | null;
  onRetry: () => void;
  visible: boolean;
  className?: string;
  retryLabel?: string;
}

/**
 * Shown in place of a result when a generation fails.
 * Displays a friendly error message and a single "Try again" CTA so users can
 * re-submit without re-filling the form.
 */
export function GenerationErrorCard({
  error,
  onRetry,
  visible,
  className,
  retryLabel = "Try again",
}: GenerationErrorCardProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-destructive/40 bg-destructive/8 px-4 py-4 animate-fade-in",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Generation failed</p>
          {error && (
            <p className="text-xs text-muted-foreground mt-0.5 break-words">{error}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent hover:border-primary/40 transition-colors"
        >
          <RefreshCw className="size-3" />
          {retryLabel}
        </button>
      </div>
    </div>
  );
}
