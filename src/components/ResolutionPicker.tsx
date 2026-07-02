import { Link } from "@tanstack/react-router";
import { Lock, Zap, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeCost, type Resolution, type Feature } from "@/lib/pricing";

type ResolutionOption = {
  value: Resolution;
  label: string;
  tag: string;
  proOnly: boolean;
};

const OPTIONS: ResolutionOption[] = [
  { value: "720p",  label: "Standard", tag: "720p",  proOnly: false },
  { value: "1080p", label: "HD",       tag: "1080p", proOnly: true  },
  { value: "2160p", label: "4K",       tag: "2160p", proOnly: true  },
];

export type ResolutionPickerProps = {
  resolution: Resolution;
  onChange: (r: Resolution) => void;
  isPro: boolean;
  /** Feature set used for per-option Aura cost display. */
  features: Feature[];
  durationSeconds?: number;
  model?: string | null;
  className?: string;
};

export function ResolutionPicker({
  resolution,
  onChange,
  isPro,
  features,
  durationSeconds,
  model,
  className,
}: ResolutionPickerProps) {
  const baseCost = computeCost({ features, resolution: "720p", durationSeconds, model }).total;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Export quality
      </label>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const cost = computeCost({ features, resolution: opt.value, durationSeconds, model }).total;
          const delta = cost - baseCost;
          const locked = opt.proOnly && !isPro;
          const active = resolution === opt.value && !locked;

          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                if (!locked) onChange(opt.value);
              }}
              aria-pressed={active}
              className={cn(
                "relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-150",
                active
                  ? "border-primary/60 bg-primary/10 shadow-[0_0_20px_-8px_oklch(0.73_0.19_44)]"
                  : locked
                  ? "border-border bg-background/20 cursor-default opacity-55 select-none"
                  : "border-border bg-background/40 hover:border-primary/30 cursor-pointer hover:bg-background/60",
              )}
            >
              {opt.proOnly && (
                <span
                  className={cn(
                    "absolute -top-2 right-2 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    locked
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/15 text-primary border border-primary/20",
                  )}
                >
                  {locked ? <Lock className="size-2.5" /> : <Crown className="size-2.5" />}
                  Pro
                </span>
              )}

              <span className="text-sm font-semibold text-foreground leading-none mt-0.5">
                {opt.label}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none">{opt.tag}</span>
              <span
                className={cn(
                  "flex items-center gap-1 text-[11px] font-medium mt-1",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Zap className="size-3 shrink-0" />
                {cost} Aura{delta > 0 ? ` (+${delta})` : ""}
              </span>
            </button>
          );
        })}
      </div>

      {!isPro && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Lock className="size-3 shrink-0" />
          HD &amp; 4K require{" "}
          <Link to="/billing" className="text-primary underline underline-offset-2">
            Pro
          </Link>
          .
        </p>
      )}
    </div>
  );
}
