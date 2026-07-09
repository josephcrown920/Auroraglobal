import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile, createPaystackCheckout, createProSubscriptionCheckout, cancelProSubscription, setDailySpendLimit } from "@/lib/billing.functions";
import { markFirstPurchaseComplete } from "@/lib/first-run";
import { redeemPromoCode } from "@/lib/promo.functions";
import { PLANS, SUBSCRIPTION_TIERS } from "@/lib/billing.plans";
import { toast } from "sonner";
import { ArrowLeft, Zap, Star, CheckCircle2, XCircle, CreditCard, Loader2, Crown, Tag, Rocket, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

export const Route = createFileRoute("/billing")({
  component: BillingPage,
  head: () => ({
    meta: [
      { title: "Plan & Billing — Aurora" },
      { name: "description", content: "Manage your Aurora subscription, view your Aura balance, and purchase credit packs." },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/billing" }],
  }),
});

function BillingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const checkoutFn = useServerFn(createPaystackCheckout);
  const proCheckoutFn = useServerFn(createProSubscriptionCheckout);
  const cancelFn = useServerFn(cancelProSubscription);
  const redeemFn = useServerFn(redeemPromoCode);
  const setLimitFn = useServerFn(setDailySpendLimit);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [dailyLimitInput, setDailyLimitInput] = useState("");

  const search = Route.useSearch() as Record<string, string>;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if ((search as any)?.subscribed === "1") {
      toast.success("Welcome to Aurora Pro! Your plan is now active.");
      qc.invalidateQueries({ queryKey: ["profile"] });
      markFirstPurchaseComplete();
    }
  }, []);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn(),
    enabled: !!user,
  });

  const isPro = profile?.plan === "pro";
  const isCancellationPending = profile?.subscription_status === "cancellation_pending";
  const tier = SUBSCRIPTION_TIERS[isPro ? "pro" : "free"];

  useEffect(() => {
    if (profile && dailyLimitInput === "") {
      const limit = (profile as { daily_spend_limit?: number | null }).daily_spend_limit;
      if (limit) setDailyLimitInput(String(limit));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const proMut = useMutation({
    mutationFn: () => proCheckoutFn({ data: undefined }),
    onSuccess: ({ authorizationUrl }) => { window.location.href = authorizationUrl; },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Checkout failed"),
  });

  const packMut = useMutation({
    mutationFn: (plan: "starter" | "creator" | "studio") =>
      checkoutFn({ data: { plan, ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}) } }),
    onSuccess: ({ authorizationUrl }) => { window.location.href = authorizationUrl; },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Checkout failed"),
  });

  const redeemMut = useMutation({
    mutationFn: () => redeemFn({ data: { code: redeemCode.trim() } }),
    onSuccess: (res) => {
      toast.success(`+${res.credits} Aura added to your balance!`);
      setRedeemCode("");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't redeem that code"),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancelFn({ data: undefined }),
    onSuccess: () => {
      toast.success("Subscription cancelled. Your Pro access remains until the end of the billing period.");
      qc.invalidateQueries({ queryKey: ["profile"] });
      setCancelConfirm(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Cancel failed"),
  });

  const setLimitMut = useMutation({
    mutationFn: (limit: number | null) => setLimitFn({ data: { limit } }),
    onSuccess: (res) => {
      toast.success(res.daily_spend_limit ? `Daily limit set to ${res.daily_spend_limit} Aura.` : "Daily limit removed.");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't update your limit"),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      <header className="relative z-10 flex items-center justify-between pl-24 pr-6 md:pl-24 md:pr-10 py-5 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <img src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
          Plan &amp; Billing
        </Link>
      </header>

      <div className="relative z-10 max-w-3xl mx-auto p-6 md:p-10 space-y-8">

        {/* Current plan */}
        <section>
          <h1 className="text-2xl font-semibold tracking-tight mb-1">Your plan</h1>
          <p className="text-sm text-muted-foreground mb-4">Manage your subscription and Aura balance.</p>

          {profileLoading ? (
            <div className="aurora-glass rounded-2xl p-6 flex items-center gap-3">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading…</span>
            </div>
          ) : (
            <div className={`aurora-glass rounded-2xl p-6 border ${isPro ? "border-primary/40" : "border-border"}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {isPro ? (
                      <Crown className="size-5 text-primary" />
                    ) : (
                      <Zap className="size-5 text-muted-foreground" />
                    )}
                    <span className="text-lg font-semibold">{tier.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isCancellationPending
                        ? "bg-amber-500/20 text-amber-400"
                        : isPro ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {isCancellationPending ? "Cancelling" : isPro ? "Active" : "Current"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{tier.price_display}</p>
                  {isPro && profile?.subscription_expires_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {isCancellationPending
                        ? <>Pro access until <strong>{new Date(profile.subscription_expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong></>
                        : <>Renews {new Date(profile.subscription_expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</>
                      }
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-2xl font-bold text-foreground">{profile?.credits ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Aura balance</div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border grid sm:grid-cols-2 gap-2">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                    {f}
                  </div>
                ))}
                {tier.limitations.map((l) => (
                  <div key={l} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <XCircle className="size-4 text-muted-foreground/50 shrink-0" />
                    {l}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Upgrade CTA — only for free users */}
        {!isPro && !profileLoading && (
          <section>
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="size-5 text-primary" />
                <h2 className="text-lg font-semibold">Upgrade to Pro</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Remove watermarks, jump the queue, unlock premium templates — and get 200 Aura every month.
              </p>
              <ul className="space-y-1 mb-5">
                {SUBSCRIPTION_TIERS.pro.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => proMut.mutate()}
                disabled={proMut.isPending}
                className="w-full sm:w-auto"
                variant="premium"
              >
                {proMut.isPending ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <Crown className="size-4 mr-2" />
                )}
                Upgrade to Pro — $15 / month
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Cancel anytime. Secure payment via Paystack.</p>
            </div>
          </section>
        )}

        {/* Growth Tools highlight */}
        <section>
          <div className="aurora-glass rounded-2xl p-5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Rocket className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Growth Tools</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium uppercase tracking-wide">Pro</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Daily post generator, AI rollout plans and social media packs — promote every release like a label would.
              </p>
            </div>
            <Link
              to="/growth"
              className="text-sm text-primary font-medium whitespace-nowrap hover:underline shrink-0"
            >
              Try it now →
            </Link>
          </div>
        </section>

        {/* Pro management — cancel */}
        {isPro && (
          <section>
            <h2 className="text-base font-medium mb-3">Subscription management</h2>
            <div className="aurora-glass rounded-2xl p-5 border border-border space-y-3">
              {isCancellationPending ? (
                <div className="space-y-1">
                  <p className="text-sm text-amber-400 font-medium">Cancellation scheduled</p>
                  <p className="text-xs text-muted-foreground">
                    Your Pro access remains active until the end of your current billing period.
                    {profile?.subscription_expires_at && (
                      <> No further charges will be made after{" "}
                        <strong>{new Date(profile.subscription_expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.
                      </>
                    )}
                  </p>
                </div>
              ) : !cancelConfirm ? (
                <button
                  type="button"
                  onClick={() => setCancelConfirm(true)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel subscription
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Are you sure? Your Pro access will remain active until the end of the current billing period — no charges after that.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => cancelMut.mutate()}
                      disabled={cancelMut.isPending}
                    >
                      {cancelMut.isPending && <Loader2 className="size-3 animate-spin mr-1" />}
                      Yes, cancel renewal
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCancelConfirm(false)}>
                      Keep Pro
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Credit packs */}
        <section>
          <h2 className="text-base font-medium mb-1">Top up Aura</h2>
          <p className="text-sm text-muted-foreground mb-4">
            One-time credit packs — use them any time on top of your monthly allowance.
          </p>

          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Promo code (optional)"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                className="pl-8"
              />
            </div>
            {promoCode.trim() && (
              <span className="text-xs text-muted-foreground">Applied at checkout below</span>
            )}
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {(["starter", "creator", "studio"] as const).map((key) => {
              const p = PLANS[key];
              return (
                <div key={key} className="aurora-glass rounded-2xl border border-border p-4 flex flex-col gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Star className="size-3.5 text-amber-400" />
                      <span className="font-medium text-sm">{p.credits} Aura</span>
                    </div>
                    <p className="text-xl font-bold">${p.usd}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">${(p.usd / p.credits).toFixed(3)} per Aura</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => packMut.mutate(key)}
                    disabled={packMut.isPending}
                  >
                    {packMut.isPending ? <Loader2 className="size-3 animate-spin" /> : (
                      <><CreditCard className="size-3 mr-1" /> Buy</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bonus code redemption */}
        <section>
          <h2 className="text-base font-medium mb-1">Have a bonus code?</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Redeem a signup or campaign code for instant Aura — separate from discount codes above.
          </p>
          <form
            className="flex flex-wrap gap-2 max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              if (redeemCode.trim()) redeemMut.mutate();
            }}
          >
            <div className="relative flex-1 min-w-[180px]">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="e.g. WELCOME2026"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline" disabled={!redeemCode.trim() || redeemMut.isPending}>
              {redeemMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Redeem"}
            </Button>
          </form>
        </section>

        {/* Daily Aura spend limit */}
        <section>
          <h2 className="text-base font-medium mb-1">Daily Spend Limit</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Cap how much Aura you can spend generating in a single day. Leave it blank for no limit.
          </p>
          <form
            className="flex flex-wrap gap-2 max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = dailyLimitInput.trim();
              if (!trimmed) return;
              const parsed = Number(trimmed);
              if (!Number.isInteger(parsed) || parsed <= 0) {
                toast.error("Enter a whole number of Aura greater than 0");
                return;
              }
              setLimitMut.mutate(parsed);
            }}
          >
            <div className="relative flex-1 min-w-[180px]">
              <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="number"
                min={1}
                placeholder="e.g. 50"
                value={dailyLimitInput}
                onChange={(e) => setDailyLimitInput(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline" disabled={!dailyLimitInput.trim() || setLimitMut.isPending}>
              {setLimitMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
            </Button>
            {!!(profile as { daily_spend_limit?: number | null } | undefined)?.daily_spend_limit && (
              <Button
                type="button"
                variant="ghost"
                disabled={setLimitMut.isPending}
                onClick={() => {
                  setDailyLimitInput("");
                  setLimitMut.mutate(null);
                }}
              >
                Clear
              </Button>
            )}
          </form>
        </section>
      </div>
    </main>
  );
}
