import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile, createPaystackCheckout, createProSubscriptionCheckout, cancelProSubscription, setDailySpendLimit, getCryptoEnabled, getDailySpend } from "@/lib/billing.functions";
import { createCryptoCheckout } from "@/lib/crypto-checkout.functions";
import { amIAdmin } from "@/lib/admin.functions";
import { markFirstPurchaseComplete } from "@/lib/first-run";
import { redeemPromoCode } from "@/lib/promo.functions";
import {
  PLANS,
  SUBSCRIPTION_TIERS,
  computePaystackPrice,
  formatLocalPrice,
  type PaystackCurrency,
} from "@/lib/billing.plans";
import { REGIONS } from "@/lib/geo-pricing";
import { detectCurrency } from "@/lib/geo.functions";
import { toast } from "sonner";
import {
  ArrowLeft, Zap, Star, CheckCircle2, XCircle, CreditCard, Loader2,
  Crown, Tag, Rocket, Gauge, Lock, Calendar, RefreshCw, Bell,
  Sparkles, Image, Film, Mic2, TrendingUp, ChevronRight, Globe,
} from "lucide-react";
import { PageSpinner } from "@/components/PageSpinner";
import { AuthRedirect } from "@/components/AuthRedirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAutoReloadSettings, saveAutoReloadSettings } from "@/hooks/use-auto-reload";
import { AURA_VALUE_SCENARIOS, auraValueEstimate } from "@/lib/pricing";
import { shouldConfirmPackPurchase } from "@/lib/billing-pack-confirm";

export const Route = createLazyFileRoute("/billing")({ component: BillingPage });

const AURA_EXAMPLES = [
  { icon: Image, scenario: "image", color: "text-brand" },
  { icon: Film, scenario: "video", color: "text-cyan-400" },
  { icon: Mic2, scenario: "lipsync", color: "text-emerald-400" },
  { icon: TrendingUp, scenario: "performance", color: "text-amber-400" },
] as const;

const PLAN_CONTEXT: Record<"starter" | "creator" | "studio", { name: string; bestFor: string }> = {
  starter: { name: "Starter", bestFor: "Trying your first visual run" },
  creator: { name: "Creator", bestFor: "Building a release week" },
  studio: { name: "Studio", bestFor: "Making a complete campaign" },
};

const PREVIEW_COUNTRY_BY_CURRENCY: Record<PaystackCurrency, string> = {
  USD: "US",
  NGN: "NG",
  GHS: "GH",
  ZAR: "ZA",
  KES: "KE",
  EGP: "EG",
};

function BillingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const checkoutFn = useServerFn(createPaystackCheckout);
  const cryptoFn = useServerFn(createCryptoCheckout);
  const proCheckoutFn = useServerFn(createProSubscriptionCheckout);
  const cancelFn = useServerFn(cancelProSubscription);
  const redeemFn = useServerFn(redeemPromoCode);
  const setLimitFn = useServerFn(setDailySpendLimit);
  const getDailySpendFn = useServerFn(getDailySpend);
  const detectCurrencyFn = useServerFn(detectCurrency);

  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [redeemCode, setRedeemCode] = useState("");
  const [dailyLimitInput, setDailyLimitInput] = useState("");
  // Pack key currently awaiting the "won't fund a performance render" confirmation.
  const [confirmPack, setConfirmPack] = useState<"starter" | "creator" | "studio" | null>(null);
  const [autoReload, setAutoReload] = useState(() => getAutoReloadSettings());

  const cryptoEnabledFn = useServerFn(getCryptoEnabled);
  const cryptoEnabledQ = useQuery({
    queryKey: ["crypto-enabled"],
    queryFn: () => cryptoEnabledFn(),
    staleTime: Infinity,
    retry: false,
  });
  const cryptoEnabled = cryptoEnabledQ.data?.enabled === true;

  const amIAdminFn = useServerFn(amIAdmin);
  const adminQ = useQuery({
    queryKey: ["am-i-admin", user?.id],
    queryFn: () => amIAdminFn(),
    enabled: !!user,
    staleTime: Infinity,
    retry: false,
  });
  const isAdmin = adminQ.data?.isAdmin === true;
  const { data: geo } = useQuery({
    queryKey: ["geo-currency"],
    queryFn: () => detectCurrencyFn(),
    staleTime: 60 * 60 * 1000,
  });
  // Keep the owner preview, but real visitors always see their server-detected
  // country and checkout-safe currency.
  const [previewRegion, setPreviewRegion] = useState<PaystackCurrency>("NGN");
  const previewing = isAdmin && previewRegion !== geo?.currency;
  const region: PaystackCurrency = previewing ? previewRegion : ((geo?.currency ?? "USD") as PaystackCurrency);
  const pricingCountry = previewing ? PREVIEW_COUNTRY_BY_CURRENCY[previewRegion] : geo?.country ?? null;
  const localPrice = (amountUsdMinor: number) => computePaystackPrice(amountUsdMinor, pricingCountry);
  const proPriceLabel = `${formatLocalPrice(localPrice(SUBSCRIPTION_TIERS.pro.price_amount_minor))} / month`;
  const hasLocalPricing = !previewing && (geo?.pppMultiplier ?? 1) < 1;

  const search = Route.useSearch() as Record<string, string>;

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  useEffect(() => {
    if ((search as Record<string, string | undefined>)?.subscribed === "1") {
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

  const { data: dailySpendData } = useQuery({
    queryKey: ["daily-spend", user?.id],
    queryFn: () => getDailySpendFn(),
    enabled: !!user,
    // Refetch when the billing page is refocused, as the user may have
    // generated content in another tab since they opened this page.
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });
  const spentToday = dailySpendData?.spentToday ?? 0;

  const isPro = profile?.plan === "pro";
  const isCancellationPending = profile?.subscription_status === "cancellation_pending";
  const tier = SUBSCRIPTION_TIERS[isPro ? "pro" : "free"];
  const credits = profile?.credits ?? 0;
  const balanceEstimates = useMemo(
    () => AURA_EXAMPLES.map((example) => {
      const scenario = AURA_VALUE_SCENARIOS.find((item) => item.id === example.scenario)!;
      return { ...example, ...scenario, ...auraValueEstimate(credits, example.scenario) };
    }),
    [credits],
  );

  useEffect(() => {
    if (profile && dailyLimitInput === "") {
      const limit = (profile as { daily_spend_limit?: number | null }).daily_spend_limit;
      if (limit) setDailyLimitInput(String(limit));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setDailyLimitInput is a stable useState setter; dep narrowed to profile so it populates once on load
  }, [profile]);

  const proMut = useMutation({
    mutationFn: () => proCheckoutFn({ data: undefined }),
    onSuccess: ({ authorizationUrl }) => { window.location.href = authorizationUrl; },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Checkout failed"),
  });

  const packMut = useMutation({
    mutationFn: (plan: "day1" | "day2" | "starter" | "creator" | "studio") =>
      checkoutFn({ data: { plan, ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}) } }),
    onSuccess: ({ authorizationUrl }) => { window.location.href = authorizationUrl; },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Checkout failed"),
  });

  const cryptoMut = useMutation({
    mutationFn: (plan: "day1" | "day2" | "starter" | "creator" | "studio") =>
      cryptoFn({ data: { plan, ...(promoCode.trim() ? { promoCode: promoCode.trim() } : {}) } }),
    onSuccess: ({ authorizationUrl }) => { window.location.href = authorizationUrl; },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Crypto checkout failed"),
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

  if (loading) return <PageSpinner />;
  if (!user) return <AuthRedirect />;

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between pl-5 pr-5 py-5 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight no-underline text-foreground">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
          Plan &amp; Billing
        </Link>
        {isPro && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Crown className="size-3" /> Pro
          </span>
        )}
      </header>

      <div className="relative z-10 max-w-2xl mx-auto p-6 md:p-10 space-y-10">

        {/* ── Aura Balance Hero ── */}
        <section>
          <div className="relative rounded-[28px] overflow-hidden border border-brand/25 bg-gradient-to-br from-zinc-900 via-zinc-950/90 to-zinc-900 shadow-[0_0_80px_-30px_oklch(0.58_0.22_25)]">
            {/* top accent */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            {/* ambient */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-full bg-primary/10 blur-[80px]" />
            </div>

            <div className="relative px-8 py-10 flex flex-col items-center text-center gap-3">
              {/* Plan badge */}
              {profileLoading ? (
                <div className="h-6 w-24 rounded-full bg-white/10 animate-pulse" />
              ) : (
                <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] border ${
                  isPro
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-white/10 border-white/20 text-white/60"
                }`}>
                  {isPro ? <Crown className="size-3" /> : <Zap className="size-3" />}
                  {tier.label} Plan
                  {isCancellationPending && <span className="ml-1 text-amber-400">· Cancelling</span>}
                </div>
              )}

              {/* Big balance */}
              {profileLoading ? (
                <div className="h-20 w-32 rounded-xl bg-white/10 animate-pulse" />
              ) : (
                <div>
                  <div className="text-[5rem] font-black leading-none tracking-tight aurora-gradient-text">
                    {credits}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium mt-1">Aura balance</div>
                </div>
              )}

              {/* What does Aura buy? */}
              <div className="w-full mt-4 pt-5 border-t border-white/10">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-3">What does your Aura buy?</p>
                <div className="grid grid-cols-2 gap-2">
                  {balanceEstimates.map(({ icon: Icon, label, cost, color }) => (
                    <div key={label} className="flex items-center gap-2.5 rounded-xl bg-white/5 border border-white/8 px-3 py-2">
                      <Icon className={`size-4 shrink-0 ${color}`} />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-white/80">{label}</p>
                        <p className="text-[10px] text-white/40">{cost} Aura each at 720p / 5s</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plan features */}
              <div className="w-full mt-2 grid sm:grid-cols-2 gap-1.5 text-left">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-white/70">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" /> {f}
                  </div>
                ))}
                {tier.limitations.map((l) => (
                  <div key={l} className="flex items-center gap-2 text-xs text-white/35">
                    <XCircle className="size-3.5 text-white/20 shrink-0" /> {l}
                  </div>
                ))}
              </div>

              {/* Pro expiry or renewal */}
              {isPro && profile?.subscription_expires_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  {isCancellationPending
                    ? <>Pro access until <strong>{new Date(profile.subscription_expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong></>
                    : <>Renews {new Date(profile.subscription_expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</>
                  }
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Owner-only: preview pricing as another region ── */}
        {isAdmin && (
          <section>
            <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Globe className="size-4 text-primary" />
                <h3 className="text-sm font-semibold">Owner preview — view pricing as</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(REGIONS) as PaystackCurrency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPreviewRegion(c)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      region === c
                        ? "border-primary/60 bg-primary/20 text-primary"
                        : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {REGIONS[c].name} · {REGIONS[c].symbol.trim()}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2.5 leading-relaxed">
                {previewing
                  ? `Previewing the ${REGIONS[region].name} (${region}) price table. Buy buttons are disabled while previewing. Real visitors receive server-detected local pricing.`
                  : "Only you can see this. Real visitors receive server-detected currency and PPP pricing."}
              </p>
            </div>
          </section>
        )}

        {/* ── Upgrade to Pro ── */}
        {!isPro && !profileLoading && (
          <section>
            <div className="relative rounded-[24px] overflow-hidden border border-brand/30 bg-gradient-to-br from-brand/12 via-zinc-950/80 to-zinc-900 shadow-[0_0_50px_-20px_oklch(0.58_0.22_25)]">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="px-7 py-8">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="inline-flex items-center gap-2 mb-2">
                      <Crown className="size-5 text-primary" />
                      <span className="text-xl font-bold">Aurora Pro</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold border border-primary/30">{proPriceLabel}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">2,000 Aura every month + no watermarks + priority queue + Growth Tools.</p>
                    {hasLocalPricing && (
                      <span className="mt-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                        Local pricing applied
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2 mb-6">
                  {SUBSCRIPTION_TIERS.pro.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="size-4 text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => proMut.mutate()}
                  disabled={proMut.isPending || previewing}
                  variant="premium"
                  className="w-full text-base py-6 rounded-xl shadow-[0_0_30px_-8px_oklch(0.58_0.22_25)]"
                >
                  {proMut.isPending ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <Crown className="size-4 mr-2" />
                  )}
                  Upgrade to Pro — {proPriceLabel}
                </Button>
                <p className="text-xs text-muted-foreground mt-2.5 text-center">Cancel anytime · Secure payment via Paystack</p>
              </div>
            </div>
          </section>
        )}

        {/* ── Top up Aura ── */}
        <section>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> Top up Aura
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            One-time Aura packs that never expire. “Up to” estimates use 720p / 5-second defaults; premium models, longer clips and add-ons cost more.
          </p>

          {/* Promo code */}
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
              <span className="text-xs text-primary font-medium">✓ Applied at checkout</span>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {(["starter", "creator", "studio"] as const).map((key) => {
              const p = PLANS[key];
              const isCreator = key === "creator";
              const estimates = AURA_VALUE_SCENARIOS.map((scenario) => ({
                ...scenario,
                ...auraValueEstimate(p.credits, scenario.id),
              }));
              const performance = estimates.find((estimate) => estimate.id === "performance")!;
              return (
                <div
                  key={key}
                  className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
                    isCreator
                      ? "border-brand/50 bg-brand/8 shadow-[0_0_30px_-12px_oklch(0.58_0.22_25)]"
                      : "aurora-glass border-border"
                  }`}
                >
                  {isCreator && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand border border-brand/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_12px_-3px_oklch(0.58_0.22_25)]">
                        <Star className="size-2.5" /> Best Value
                      </span>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm">{PLAN_CONTEXT[key].name}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{PLAN_CONTEXT[key].bestFor}</span>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="text-3xl font-black">
                        {formatLocalPrice(localPrice(Math.round(p.usd * 100)))}
                      </div>
                      <span className="pb-1 text-sm font-semibold text-primary">{p.credits.toLocaleString()} Aura</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatLocalPrice({
                        ...localPrice(Math.round(p.usd * 100)),
                        amountMinor: Math.round(localPrice(Math.round(p.usd * 100)).amountMinor / p.credits),
                      })} / Aura
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-black/20 p-3 text-xs">
                    {estimates.map((estimate) => (
                      <div key={estimate.id}>
                        <p className="font-bold text-white">Up to {estimate.count}</p>
                        <p className="text-white/45">{estimate.shortLabel}</p>
                      </div>
                    ))}
                  </div>
                  {performance.count === 0 ? (
                    <p className="text-xs leading-relaxed text-amber-300/90">
                      This pack does not cover a complete 5-second Perform Anywhere render. Choose Creator or Studio for performance work.
                    </p>
                  ) : (
                    <p className="text-xs leading-relaxed text-emerald-300/90">
                      Covers up to {performance.count} complete 5-second Perform Anywhere {performance.count === 1 ? "render" : "renders"} at the representative setting.
                    </p>
                  )}
                  {confirmPack === key && (
                    <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-200">
                      <p className="font-semibold mb-1.5">Just so you know</p>
                      <p className="text-amber-200/90">
                        This pack won&apos;t fund a full Perform Anywhere render — continue?
                      </p>
                      <button
                        type="button"
                        onClick={() => setConfirmPack(null)}
                        className="mt-2 text-[11px] font-semibold text-amber-300/80 underline underline-offset-2 hover:text-amber-200"
                      >
                        Never mind
                      </button>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant={isCreator ? "premium" : "outline"}
                    className="w-full"
                    onClick={() => {
                      // Packs that can't cover a performance render get one
                      // inline confirmation step before checkout — it never
                      // blocks the purchase, it only makes the warning seen.
                      if (shouldConfirmPackPurchase({ performanceCount: performance.count, confirmedKey: confirmPack, key })) {
                        setConfirmPack(key);
                        return;
                      }
                      setConfirmPack(null);
                      packMut.mutate(key);
                    }}
                    disabled={packMut.isPending || cryptoMut.isPending || previewing}
                  >
                    {packMut.isPending ? <Loader2 className="size-3 animate-spin" /> : confirmPack === key ? (
                      <><CreditCard className="size-3 mr-1" /> Continue anyway — Get {PLAN_CONTEXT[key].name} Aura</>
                    ) : (
                      <><CreditCard className="size-3 mr-1" /> Get {PLAN_CONTEXT[key].name} Aura</>
                    )}
                  </Button>
                  {cryptoEnabled && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-xs text-muted-foreground hover:text-amber-300"
                      onClick={() => {
                        if (shouldConfirmPackPurchase({ performanceCount: performance.count, confirmedKey: confirmPack, key })) {
                          setConfirmPack(key);
                          return;
                        }
                        setConfirmPack(null);
                        cryptoMut.mutate(key);
                      }}
                      disabled={packMut.isPending || cryptoMut.isPending || previewing}
                      title="Pay with BTC, ETH, USDT, USDC and more"
                    >
                      {cryptoMut.isPending ? <Loader2 className="size-3 animate-spin" /> : confirmPack === key ? <>₿ Continue anyway — pay with crypto</> : <>₿ Pay with crypto</>}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Quick Access Day Passes ── */}
        <section>
          <h2 className="text-base font-semibold flex items-center gap-2 mb-1">
            <Calendar className="size-4 text-primary" /> Quick Access Passes
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Short-term passes for occasional use — auto-set a daily limit so your credits last the full pass.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {(["day1", "day2"] as const).map((key) => {
              const p = PLANS[key];
              return (
                <div key={key} className="rounded-2xl border border-border bg-card/40 p-4 flex flex-col gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className="size-3.5 text-primary" />
                      <span className="font-semibold text-sm text-primary">
                        {key === "day1" ? "1-Day Pass" : "2-Day Pass"}
                      </span>
                    </div>
                    <div className="text-xl font-black">
                      {formatLocalPrice(localPrice(Math.round(p.usd * 100)))}
                    </div>
                    <p className="text-[13px] font-semibold text-foreground/80 mt-0.5">{p.credits} Aura</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(() => {
                        const images = auraValueEstimate(p.credits, "image").count;
                        const videos = auraValueEstimate(p.credits, "video").count;
                        return key === "day1"
                          ? `Up to ${images} images or ${videos} short video — auto-limits 150 Aura/day`
                          : `Up to ${images} images or ${videos} short videos — auto-limits 130 Aura/day`;
                      })()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => packMut.mutate(key)}
                    disabled={packMut.isPending || previewing}
                  >
                    {packMut.isPending ? <Loader2 className="size-3 animate-spin" /> : <><CreditCard className="size-3 mr-1" /> Get pass</>}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Growth Tools ── */}
        <section>
          <div className={`aurora-glass rounded-2xl p-5 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isPro ? "border-primary/30" : "border-border opacity-80"}`}>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isPro ? <Rocket className="size-4 text-primary" /> : <Lock className="size-4 text-muted-foreground" />}
                <h3 className="text-base font-semibold">Growth Tools</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold border border-primary/30 uppercase tracking-wide">Pro</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Daily post generator, AI rollout plans and social media packs — promote every release like a label would.
              </p>
            </div>
            {isPro ? (
              <Link to="/growth" className="text-sm text-primary font-semibold whitespace-nowrap hover:underline shrink-0 no-underline flex items-center gap-1">
                Open <ChevronRight className="size-3.5" />
              </Link>
            ) : (
              <Button size="sm" variant="outline" className="shrink-0 border-primary/40 text-primary hover:bg-primary/10" onClick={() => proMut.mutate()} disabled={proMut.isPending || previewing}>
                {proMut.isPending ? <Loader2 className="size-3 animate-spin mr-1" /> : <Crown className="size-3 mr-1" />}
                Upgrade to unlock
              </Button>
            )}
          </div>
        </section>

        {/* ── Bonus code ── */}
        <section>
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Tag className="size-4 text-primary" /> Have a bonus code?
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Redeem a signup or campaign code for instant Aura — separate from promo codes above.
          </p>
          <form
            className="flex flex-wrap gap-2 max-w-md"
            onSubmit={(e) => { e.preventDefault(); if (redeemCode.trim()) redeemMut.mutate(); }}
          >
            <div className="relative flex-1 min-w-[180px]">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input placeholder="e.g. WELCOME2026" value={redeemCode} onChange={(e) => setRedeemCode(e.target.value)} className="pl-8" />
            </div>
            <Button type="submit" variant="outline" disabled={!redeemCode.trim() || redeemMut.isPending}>
              {redeemMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Redeem"}
            </Button>
          </form>
        </section>

        {/* ── Auto Top-up ── */}
        <section>
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <RefreshCw className="size-4 text-primary" /> Auto Top-up Alerts
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Get an alert when your Aura drops low. One tap takes you straight to checkout — no hidden charges.
          </p>
          <div className="rounded-xl border border-border bg-card/60 p-4 max-w-md flex flex-col gap-4">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm font-medium flex items-center gap-2">
                <Bell className="size-4 text-primary" />
                {autoReload.enabled ? "Alerts ON" : "Enable alerts"}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = { ...autoReload, enabled: !autoReload.enabled };
                  setAutoReload(next);
                  saveAutoReloadSettings(next);
                  toast.success(next.enabled ? "Auto-top-up alerts enabled" : "Alerts disabled");
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoReload.enabled ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${autoReload.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </label>

            {autoReload.enabled && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5 block">
                    Alert when balance drops below
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[5, 10, 20, 50].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          const next = { ...autoReload, threshold: v };
                          setAutoReload(next);
                          saveAutoReloadSettings(next);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          autoReload.threshold === v
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {v} Aura
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Daily Spend Limit ── */}
        <section>
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <Gauge className="size-4 text-primary" /> Daily Spend Limit
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Cap how much Aura you can spend per day — useful for budgeting across a week or month.
          </p>

          {/* Today's spend progress (shown when a limit is set) */}
          {!!(profile as { daily_spend_limit?: number | null } | undefined)?.daily_spend_limit && (() => {
            const limit = (profile as { daily_spend_limit: number }).daily_spend_limit;
            const pct = Math.min(100, Math.round((spentToday / limit) * 100));
            const atLimit = spentToday >= limit;
            return (
              <div className="mb-4 max-w-md space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Today's spend</span>
                  <span className={`font-semibold tabular-nums ${atLimit ? "text-destructive" : "text-foreground"}`}>
                    {spentToday} / {limit} Aura
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${atLimit ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {atLimit && (
                  <p className="text-xs text-destructive">Daily limit reached — resets at UTC midnight.</p>
                )}
              </div>
            );
          })()}

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
                placeholder="e.g. 50 Aura/day"
                value={dailyLimitInput}
                onChange={(e) => setDailyLimitInput(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button type="submit" variant="outline" disabled={!dailyLimitInput.trim() || setLimitMut.isPending}>
              {setLimitMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
            </Button>
            {!!(profile as { daily_spend_limit?: number | null } | undefined)?.daily_spend_limit && (
              <Button type="button" variant="ghost" disabled={setLimitMut.isPending} onClick={() => { setDailyLimitInput(""); setLimitMut.mutate(null); }}>
                Clear
              </Button>
            )}
          </form>

          {/* Today's spend shown even without a limit — gives the user awareness */}
          {!(profile as { daily_spend_limit?: number | null } | undefined)?.daily_spend_limit && spentToday > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              You've spent <span className="font-semibold text-foreground">{spentToday} Aura</span> today (UTC). Set a limit above to cap daily usage.
            </p>
          )}
        </section>

        {/* ── Pro subscription management ── */}
        {isPro && (
          <section>
            <h2 className="text-base font-semibold mb-3 text-muted-foreground">Subscription management</h2>
            <div className="aurora-glass rounded-2xl p-5 border border-border space-y-3">
              {isCancellationPending ? (
                <div className="space-y-1">
                  <p className="text-sm text-amber-400 font-medium">Cancellation scheduled</p>
                  <p className="text-xs text-muted-foreground">
                    Your Pro access remains active until the end of your current billing period.
                    {profile?.subscription_expires_at && (
                      <> No further charges after{" "}
                        <strong>{new Date(profile.subscription_expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.
                      </>
                    )}
                  </p>
                </div>
              ) : !cancelConfirm ? (
                <button type="button" onClick={() => setCancelConfirm(true)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Cancel subscription
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Are you sure? Your Pro access stays active until the end of the billing period.
                  </p>
                  <div className="flex gap-3">
                    <Button size="sm" variant="destructive" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
                      {cancelMut.isPending && <Loader2 className="size-3 animate-spin mr-1" />}
                      Yes, cancel renewal
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setCancelConfirm(false)}>Keep Pro</Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </main>
  );
}
