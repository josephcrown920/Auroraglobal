import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlanLimitWarning } from "@/lib/billing.plans";

/**
 * Inline pre-generate warning for plan-tier limits (duration cap, HD/4K
 * entitlement). Rendered near the generate button so the user learns about a
 * blocker BEFORE clicking into a guaranteed server-side rejection — never
 * from a failed render.
 *
 * Severity follows PlanLimitWarning.blocksNextRender:
 *  - true  → red: the very next click would be rejected server-side.
 *  - false → amber: the cheap 480p preview still runs; only the later
 *            full-quality render is gated.
 */
export function PlanLimitNotice({
  warnings,
  className,
}: {
  warnings: PlanLimitWarning[];
  className?: string;
}) {
  if (warnings.length === 0) return null;
  return (
    <div className={cn("space-y-2", className)} data-testid="plan-limit-notice">
      {warnings.map((w) => (
        <div
          key={w.code}
          data-testid={`plan-limit-${w.code}`}
          className={cn(
            "rounded-xl border px-3 py-2.5 text-xs leading-relaxed",
            w.blocksNextRender
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-amber-500/30 bg-amber-500/10 text-amber-200",
          )}
        >
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 size-3.5 shrink-0 opacity-80" />
            <div className="min-w-0 flex-1">
              <p>{w.message}</p>
              <p className="mt-1 text-[11px] opacity-75">
                Your plan allows up to {w.limitLabel} — this selection is {w.requestedLabel}.
                {!w.blocksNextRender &&
                  " The 480p preview still runs; only the full-quality render is blocked."}
              </p>
              {w.upgradeTier === "pro" && (
                <Link
                  to="/billing"
                  className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/20"
                >
                  Upgrade to Pro
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
