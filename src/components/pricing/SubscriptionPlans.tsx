import { CheckCircle2, Zap, Star, Crown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_PLANS, type PlanId } from "@/lib/subscription-plans";

const PLAN_ICONS: Record<PlanId, React.ReactNode> = {
  free:    <Zap className="size-5 text-white/50" />,
  creator: <Star className="size-5 text-amber-400" />,
  pro:     <Crown className="size-5 text-primary" />,
  studio:  <Building2 className="size-5 text-cyan-400" />,
};

type Props = {
  currentPlanId?: string | null;
  onUpgrade?: (planId: PlanId) => void;
  onUpgradePending?: boolean;
  compact?: boolean;
};

export function SubscriptionPlans({ currentPlanId, onUpgrade, onUpgradePending, compact }: Props) {
  return (
    <section>
      {!compact && (
        <div className="mb-5">
          <h2 className="text-lg font-semibold">All plans</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Unlock more Aura and flagship features as you grow.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isFeatured = plan.featured;

          return (
            <div
              key={plan.id}
              className={[
                "relative rounded-2xl border p-5 flex flex-col gap-4 transition-all",
                isFeatured
                  ? "border-primary/40 bg-primary/8 shadow-[0_0_30px_-12px_oklch(0.72_0.2_25_/_0.4)]"
                  : "aurora-glass border-border",
              ].join(" ")}
            >
              {isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary border border-primary/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_12px_-3px_oklch(0.72_0.2_25_/_0.5)]">
                    <Star className="size-2.5" /> Recommended
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {PLAN_ICONS[plan.id]}
                    <span className="font-bold text-sm">{plan.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{plan.tagline}</p>
                </div>
                {isCurrent && (
                  <span className="shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                    Current
                  </span>
                )}
              </div>

              {/* Price */}
              <div>
                {plan.monthlyUsd === 0 ? (
                  <div className="text-2xl font-black">Free</div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black">${plan.monthlyUsd}</span>
                    <span className="text-xs text-muted-foreground">/ mo</span>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {plan.monthlyAura.toLocaleString()} Aura / month
                </p>
              </div>

              {/* Perks */}
              <ul className="flex-1 space-y-1.5">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-xs text-white/70">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    {perk}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {onUpgrade && !isCurrent && plan.id !== "free" && (
                <Button
                  size="sm"
                  variant={isFeatured ? "premium" : "outline"}
                  className="w-full"
                  onClick={() => onUpgrade(plan.id)}
                  disabled={onUpgradePending}
                >
                  Get {plan.name}
                </Button>
              )}
              {isCurrent && (
                <div className="text-center text-xs text-muted-foreground py-1">✓ Active plan</div>
              )}
              {!onUpgrade && plan.id === "free" && (
                <div className="text-center text-xs text-muted-foreground py-1">Default tier</div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
