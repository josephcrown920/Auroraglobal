import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile, createPaystackCheckout, createProSubscriptionCheckout, cancelProSubscription, setDailySpendLimit } from "@/lib/billing.functions";
import { markFirstPurchaseComplete } from "@/lib/first-run";
import { redeemPromoCode } from "@/lib/promo.functions";
import { PLANS, SUBSCRIPTION_TIERS } from "@/lib/billing.plans";
import { toast } from "sonner";
import {
  ArrowLeft, Zap, Star, CheckCircle2, XCircle, CreditCard, Loader2,
  Crown, Tag, Rocket, Gauge, Lock, Calendar, RefreshCw, Bell,
  Sparkles, Image, Film, Mic2, TrendingUp, ChevronRight,
} from "lucide-react";
import { PageSpinner } from "@/components/PageSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";
import { getAutoReloadSettings, saveAutoReloadSettings } from "@/hooks/use-auto-reload";

export const Route = createLazyFileRoute("/billing")({ component: BillingPage });

const AURA_EXAMPLES = [
  { icon: Image,  label: "1 AI image",       aura: "~1 Aura",  color: "text-violet-400" },
  { icon: Mic2,   label: "1 lip-sync video",  aura: "~3 Aura",  color: "text-emerald-400" },
  { icon: Film,   label: "1 performance clip", aura: "~10 Aura", color: "text-cyan-400" },
  { icon: TrendingUp, label: "30-post Spin pack", aura: "~30 Aura", color: "text-amber-400" },
];

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
  const [autoReload, setAutoReload] = useState(() => getAutoReloadSettings());

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
  const credits = profile?.credits ?? 0;

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
    mutationFn: (plan: "day1" | "day2" | "starter" | "creator" | "studio") =>
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

  if (loading || !user) return <PageSpinner />;

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between pl-24 pr-6 md:pl-24 md:pr-10 py-5 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/studio" className="flex items-center gap-2 font-semibold tracking-tight no-underline text-foreground">
          <ArrowLeft className="size-4 text-muted-foreground" />
          <img src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
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
          <div className="relative rounded-[28px] overflow-hidden border border-primary/40 bg-gradient-to-br from-violet-950/60 via-[#0d0820]/80 to-fuchsia-950/30 shadow-[0_0_80px_-30px_oklch(0.72_0.2_300)]">
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
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 mb-3">What does 1 Aura buy?</p>
                <div className="grid grid-cols-2 gap-2">
                  {AURA_EXAMPLES.map(({ icon: Icon, label, aura, color }) => (
                    <div key={label} className="flex items-center gap-2.5 rounded-xl bg-white/5 border border-white/8 px-3 py-2">
                      <Icon className={`size-4 shrink-0 ${color}`} />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-white/80">{label}</p>
                        <p className="text-[10px] text-white/40">{aura}</p>
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

        {/* ── Upgrade to Pro ── */}
        {!isPro && !profileLoading && (
          <section>
            <div className="relative rounded-[24px] overflow-hidden border border-primary/40 bg-gradient-to-br from-primary/15 via-violet-950/50 to-fuchsia-950/20 shadow-[0_0_50px_-20px_oklch(0.72_0.2_300)]">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="px-7 py-8">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="inline-flex items-center gap-2 mb-2">
                      <Crown className="size-5 text-primary" />
                      <span className="text-xl font-bold">Aurora Pro</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold border border-primary/30">$15 / month</span>
                    </div>
                    <p className="text-sm text-muted-foreground">200 Aura every month + no watermarks + priority queue + Growth Tools.</p>
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
                  disabled={proMut.isPending}
                  variant="premium"
                  className="w-full text-base py-6 rounded-xl shadow-[0_0_30px_-8px_oklch(0.72_0.2_300)]"
                >
                  {proMut.isPending ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : (
                    <Crown className="size-4 mr-2" />
                  )}
                  Upgrade to Pro — $15 / month
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
            One-time credit packs. Never expire. Use across every tool — images, videos, lip-sync, Spin.
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

          <div className="grid sm:grid-cols-3 gap-3">
            {(["starter", "creator", "studio"] as const).map((key, i) => {
              const p = PLANS[key];
              const isCreator = key === "creator";
              return (
                <div
                  key={key}
                  className={`relative rounded-2xl border p-5 flex flex-col gap-4 transition-all ${
                    isCreator
                      ? "border-primary/50 bg-primary/8 shadow-[0_0_30px_-12px_oklch(0.72_0.2_300)]"
                      : "aurora-glass border-border"
                  }`}
                >
                  {isCreator && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary border border-primary/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-[0_0_12px_-3px_oklch(0.72_0.2_300)]">
                        <Star className="size-2.5" /> Best Value
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Star className={`size-3.5 ${isCreator ? "text-primary" : "text-amber-400"}`} />
                      <span className="font-bold text-sm">{p.credits} Aura</span>
                    </div>
                    <div className="text-2xl font-black">${p.usd}</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      ${(p.usd / p.credits).toFixed(3)} / Aura · {i === 0 ? "~80 images" : i === 1 ? "~240 images or 24 videos" : "~640 images or 64 videos"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={isCreator ? "premium" : "outline"}
                    className="w-full"
                    onClick={() => packMut.mutate(key)}
                    disabled={packMut.isPending}
                  >
                    {packMut.isPending ? <Loader2 className="size-3 animate-spin" /> : (
                      <><CreditCard className="size-3 mr-1" /> Buy {p.credits} Aura</>
                    )}
                  </Button>
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
                    <div className="text-xl font-black">${p.usd}</div>
                    <p className="text-[13px] font-semibold text-foreground/80 mt-0.5">{p.credits} Aura</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {key === "day1"
                        ? "~15 images or 1 short video — auto-limits 15 Aura/day"
                        : "Spread across 2 days — auto-limits 13 Aura/day"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => packMut.mutate(key)}
                    disabled={packMut.isPending}
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
              <Button size="sm" variant="outline" className="shrink-0 border-primary/40 text-primary hover:bg-primary/10" onClick={() => proMut.mutate()} disabled={proMut.isPending}>
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
