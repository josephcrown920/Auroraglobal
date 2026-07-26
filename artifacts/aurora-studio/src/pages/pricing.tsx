import React from "react";
import { useGetCreditPackages, useCheckoutCredits, useGetMe } from "@workspace/api-client-react";
import { Check, Star, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@clerk/react";

export default function PricingPage() {
  const { isSignedIn } = useAuth();
  const { data: packages, isLoading } = useGetCreditPackages();
  const { data: user } = useGetMe({ query: { enabled: !!isSignedIn } });
  const checkout = useCheckoutCredits();

  const handleCheckout = (packageId: string) => {
    if (!user) {
      window.location.href = `/sign-in?redirect_url=/pricing`;
      return;
    }
    
    checkout.mutate({ data: { packageId, email: user?.email } }, {
      onSuccess: (data) => {
        window.open(data.authorizationUrl, '_blank');
      }
    });
  };

  return (
    <div className="w-full py-20">
      <div className="container mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6">Simple, transparent pricing</h1>
          <p className="text-xl text-muted-foreground">Buy credits as you need them. No monthly subscription required.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary" size={48} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {packages?.map((pkg) => (
              <div 
                key={pkg.id}
                className={`
                  relative rounded-3xl bg-card border p-8 flex flex-col
                  ${pkg.popular ? 'border-primary shadow-[0_0_30px_rgba(124,58,237,0.15)] scale-105 z-10' : 'border-border'}
                `}
              >
                {pkg.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1">
                    <Star size={12} fill="currentColor" /> Most Popular
                  </div>
                )}
                
                <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{pkg.description || `${pkg.credits} credits to fuel your creativity`}</p>
                
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">₦{pkg.priceNgn.toLocaleString()}</span>
                  {pkg.priceUsd && <span className="text-muted-foreground ml-2">/ ${pkg.priceUsd}</span>}
                </div>
                
                <div className="mb-8 p-4 bg-background/50 rounded-xl border border-border">
                  <p className="text-center font-mono text-xl font-bold text-primary">{pkg.credits} Credits</p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Check size={18} className="text-emerald-500 shrink-0" />
                    <span>~{Math.floor(pkg.credits / 10)} Video Generations</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Check size={18} className="text-emerald-500 shrink-0" />
                    <span>~{Math.floor(pkg.credits / 2)} Photo Generations</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Check size={18} className="text-emerald-500 shrink-0" />
                    <span>Access to all studio tools</span>
                  </li>
                  <li className="flex items-start gap-3 text-sm text-muted-foreground">
                    <Check size={18} className="text-emerald-500 shrink-0" />
                    <span>Commercial usage rights</span>
                  </li>
                </ul>

                <button 
                  onClick={() => handleCheckout(pkg.id)}
                  disabled={checkout.isPending}
                  className={`
                    w-full py-4 rounded-xl font-bold transition-all
                    ${pkg.popular 
                      ? 'bg-primary text-white hover:bg-primary/90' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                    }
                  `}
                >
                  {checkout.isPending ? 'Processing...' : 'Buy Package'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-24 max-w-3xl mx-auto">
          <h3 className="text-2xl font-serif font-bold text-white mb-8 text-center">Frequently Asked Questions</h3>
          <div className="space-y-6">
            <div className="bg-card border border-border p-6 rounded-2xl">
              <h4 className="font-bold text-white mb-2">How are credits consumed?</h4>
              <p className="text-muted-foreground text-sm">Different tools use different amounts of credits based on the compute required. A standard photo generation uses 2 credits, while a 10-second high-quality video uses 10 credits.</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl">
              <h4 className="font-bold text-white mb-2">Do my credits expire?</h4>
              <p className="text-muted-foreground text-sm">No, purchased credits never expire. They stay in your account until you use them.</p>
            </div>
            <div className="bg-card border border-border p-6 rounded-2xl">
              <h4 className="font-bold text-white mb-2">Can I use the outputs commercially?</h4>
              <p className="text-muted-foreground text-sm">Yes, all content generated with paid credits comes with full commercial rights. You can use them in music videos, album art, ads, and more.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
