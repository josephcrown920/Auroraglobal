import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Sparkles, Zap, Crown } from "lucide-react";
import { toast } from "sonner";
import { createPaystackCheckout } from "@/lib/billing.functions";
import { PLANS, perCreditDisplay, type PlanKey } from "@/lib/billing.plans";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/tracking";

const META: Record<PlanKey, { name: string; tagline: string; features: string[]; icon: typeof Sparkles; highlight?: boolean }> = {
  starter: {
    name: "Starter", tagline: "Test-drive the studio.", icon: Sparkles,
    features: ["80 Aurora (~16 images)", "All image models", "Lip-sync up to 8s", "Standard queue"],
  },
  creator: {
    name: "Creator", tagline: "Built for daily posting.", icon: Zap, highlight: true,
    features: ["240 Aurora (~48 videos)", "All image + video models", "Priority queue", "Commercial license", "Gallery sharing"],
  },
  studio: {
    name: "Studio", tagline: "For agencies + power users.", icon: Crown,
    features: ["640 Aurora (~130 videos)", "Every model, including Seedance Pro", "Top-priority queue", "Team sharing", "White-glove onboarding"],
  },
};

const ORDER: PlanKey[] = ["starter", "creator", "studio"];

export function PricingSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const checkout = useServerFn(createPaystackCheckout);
  const [loadingPlan, setLoadingPlan] = useState<PlanKey | null>(null);
  const currency = "USD" as const;

  const onChoose = async (plan: PlanKey) => {

    void track("pricing_cta_click", { plan, currency });
    if (!user) {
      try { localStorage.setItem("aurora_intent_plan", plan); } catch {}
      toast.info("Sign in first to complete checkout.");
      navigate({ to: "/auth" });
      return;
    }
    setLoadingPlan(plan);
    try {
      const res = await checkout({ data: { plan, currency } });
      window.location.href = res.authorizationUrl;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setLoadingPlan(null);
    }
  };

  return (
    <section id="pricing" className="relative z-10 px-6 md:px-12 pb-24">
      <div className="text-center max-w-2xl mx-auto mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-300/80 mb-2">Pricing</p>
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
          Simple Aurora. <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-200 bg-clip-text text-transparent">No subscriptions.</span>
        </h2>
        <p className="text-white/65 mt-3 text-sm md:text-base">
          One Aurora ≈ one image. Videos and lip-sync from 5 Aurora. Aurora never expires.
        </p>
      </div>

      {/* USD-only billing */}


      <div className="grid md:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
        {ORDER.map((key) => {
          const p = PLANS[key];
          const meta = META[key];
          const Icon = meta.icon;
          const price = p.prices[currency];
          return (
            <div
              key={key}
              className={`relative rounded-3xl border p-6 md:p-8 flex flex-col gap-5 transition-all duration-300 hover:-translate-y-1 ${
                meta.highlight
                  ? "border-violet-400/50 bg-gradient-to-b from-violet-500/15 to-fuchsia-500/5 shadow-2xl shadow-violet-500/20"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25"
              }`}
            >
              {meta.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.18em] px-3 py-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold shadow-lg shadow-violet-500/40">
                  Most popular
                </span>
              )}
              <div className="flex items-center gap-2">
                <span className={`size-9 rounded-xl flex items-center justify-center ${meta.highlight ? "bg-gradient-to-br from-violet-500 to-fuchsia-500" : "bg-white/10"}`}>
                  <Icon className="size-4 text-white" />
                </span>
                <div>
                  <p className="font-semibold text-lg leading-none">{meta.name}</p>
                  <p className="text-[11px] text-white/50 mt-1">{meta.tagline}</p>
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl md:text-5xl font-semibold tracking-tight">{price.display}</span>
                  <span className="text-xs text-white/50">one-time</span>
                </div>
                <p className="text-sm text-violet-200 mt-1">{p.credits} Aurora</p>
                <p className="text-[11px] text-white/40">{perCreditDisplay(key, currency)}</p>
              </div>
              <ul className="space-y-2 text-sm text-white/80">
                {meta.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onChoose(key)}
                disabled={loadingPlan !== null}
                className={`mt-auto w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-medium transition disabled:opacity-60 ${
                  meta.highlight
                    ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-xl shadow-violet-500/30 hover:opacity-95"
                    : "border border-white/15 text-white hover:bg-white/5"
                }`}
              >
                {loadingPlan === key ? (
                  <><Loader2 className="size-4 animate-spin" /> Redirecting…</>
                ) : (
                  <>Get {meta.name}</>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-white/40 mt-8">
        Secure payments by Paystack · USD billing · 7-day refund on unused Aurora ·{" "}
        <Link to="/gifts" className="underline hover:text-white/70">Gift cards available</Link>
      </p>
    </section>
  );
}
