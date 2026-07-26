import { useState } from "react";
import { useGetCreditPackages, useCheckoutCredits, useGetMe } from "@workspace/api-client-react";
import { Loader2, Check } from "lucide-react";

export default function PricingPage() {
  const { data: packages, isLoading } = useGetCreditPackages();
  const { data: user } = useGetMe();
  const checkout = useCheckoutCredits();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleCheckout = (packageId: string) => {
    if (!user) {
      window.location.href = "/sign-up";
      return;
    }
    
    setSelectedPlan(packageId);
    checkout.mutate(
      { data: { packageId } },
      {
        onSuccess: (res) => {
          if (res.authorizationUrl) {
            window.location.href = res.authorizationUrl;
          }
        },
        onError: () => setSelectedPlan(null)
      }
    );
  };

  return (
    <div className="max-w-5xl mx-auto py-24 px-6">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">Studio Pricing</h1>
        <p className="text-lg text-[#999999] max-w-2xl mx-auto">
          Pay only for what you generate. Buy Aura credits once, use them across all studio tools forever. No subscriptions.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center h-64 items-center">
          <Loader2 className="animate-spin text-brand size-8" />
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8">
          {packages?.map((pkg) => (
            <div 
              key={pkg.id} 
              className={`aurora-card p-8 flex flex-col relative overflow-hidden ${
                pkg.id === "pkg_pro" ? "border-brand shadow-[0_0_30px_rgba(0,122,255,0.15)] transform md:-translate-y-4" : ""
              }`}
            >
              {pkg.id === "pkg_pro" && (
                <div className="absolute top-0 inset-x-0 h-1 bg-brand" />
              )}
              
              <div className="mb-6">
                <h3 className={`text-xl font-display font-semibold mb-2 ${pkg.id === "pkg_pro" ? "text-brand" : "text-white"}`}>
                  {pkg.name}
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold font-sans text-white">${pkg.priceUsd}</span>
                  <span className="text-sm text-[#999999]">one-time</span>
                </div>
                <p className="mt-4 text-lg font-bold text-[#f6d365] flex items-center gap-1">
                  <span className="text-sm">✦</span> {pkg.credits.toLocaleString()} Aura
                </p>
              </div>

              <ul className="space-y-4 mb-8 flex-1">
                {[
                  "Access to Colors Studio",
                  "Access to Motion Control",
                  "Access to Lip Sync",
                  "Commercial use rights",
                  pkg.id !== "pkg_starter" ? "Priority generation queue" : "Standard generation queue"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#999999]">
                    <Check size={16} className="text-[#34C759] mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(pkg.id)}
                disabled={checkout.isPending && selectedPlan === pkg.id}
                className={`w-full py-4 rounded-xl font-bold uppercase tracking-wider text-sm transition-all ${
                  pkg.id === "pkg_pro"
                    ? "bg-brand text-white hover:bg-[#0051D5]"
                    : "bg-[#2A2A2A] text-white border border-[#333333] hover:border-[#555555] hover:bg-[#333333]"
                }`}
              >
                {checkout.isPending && selectedPlan === pkg.id ? (
                  <Loader2 className="animate-spin mx-auto" size={20} />
                ) : user ? "Buy Credits" : "Sign Up to Buy"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
