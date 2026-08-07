import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { adminOverview, adminGrantCredits, adminEarnings, adminWithdrawalSummary, adminRecordWithdrawal, adminCheckWithdrawalAmount, adminUpdateWithdrawal, adminDeleteWithdrawal } from "@/lib/admin.functions";
import { getGenerationHealth, type GenerationHealthRow } from "@/lib/generation-health.functions";
import { getSiteImages, adminUpdateSiteImage, adminResetSiteImage, type SiteImageRow } from "@/lib/site-images.functions";
import { getSiteCopy, getSiteCopyHistory, adminSetSiteCopy, adminDeleteSiteCopy, type SiteCopyRow, type SiteCopyHistoryRow } from "@/lib/site-copy.functions";
import { getRouterHealth, getRouterLogs, type RouterHealthRow, type RouterLogRow } from "@/lib/ai-router.functions";
import { SITE_COPY_DEFAULTS, SITE_COPY_LABELS, SITE_COPY_SECTIONS } from "@/lib/site-copy-defaults";
import { listWorkers, upsertWorker, deleteWorker, pingWorker, setWorkerStatus, getFreeGpuMode, setFreeGpuMode, approveWorker, rejectWorker } from "@/lib/workers.functions";
import { issuePromoCode, listPromoCodes, setPromoCodeActive, type PromoCodeRow } from "@/lib/promo.functions";
import { PROFIT_SPLIT_PCT } from "@/lib/profit-split";
import { ModelBadge } from "@/components/ModelBadge";
import { Shield, Sparkles, Loader2, Users, DollarSign, ImagePlay, Coins, ArrowRight, Server, Trash2, Activity, TrendingUp, Gift, Pause, Play, Zap, Store, Wallet, Tag, Copy, BookOpen, Image, CheckCircle, XCircle, Clock, Radar, ChevronDown, ChevronRight, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AdminGate, useAdminAutoUnlock } from "@/components/AdminGate";
import { LandingLivePreview } from "@/components/admin/LandingLivePreview";


export const Route = createLazyFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [unlocked, setUnlocked] = useAdminAutoUnlock(!!user);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const overviewFn = useServerFn(adminOverview);
  const grantFn = useServerFn(adminGrantCredits);
  const genHealthFn = useServerFn(getGenerationHealth);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn(),
    enabled: !!user && unlocked,
    refetchInterval: 30_000,
  });

  const { data: genHealth } = useQuery({
    queryKey: ["admin-gen-health"],
    queryFn: () => genHealthFn(),
    enabled: !!user && unlocked,
    refetchInterval: 60_000,
  });


  const [tab, setTab] = useState<"gens" | "users" | "payments" | "earnings" | "workers" | "promos" | "images" | "copy" | "router" | "resources">("gens");
  const [grantUser, setGrantUser] = useState("");
  const [grantAmount, setGrantAmount] = useState(100);

  const grantMut = useMutation({
    mutationFn: async () => grantFn({ data: { userId: grantUser, amount: grantAmount } }),
    onSuccess: () => { toast.success("Aura granted"); qc.invalidateQueries({ queryKey: ["admin-overview"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;


  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4">
          <Shield className="size-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Forbidden"}</p>
          <Link to="/dashboard" className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            Back to dashboard <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  const s = data?.stats;
  const jobsByGen = new Map(
    (data?.jobs ?? [])
      .filter((j) => j.generation_id)
      .map((j) => [j.generation_id as string, j] as const),
  );

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between pl-5 pr-5 py-5 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
          Aurora Studio
          <span className="ml-2 text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center gap-1"><Shield className="size-3" /> Admin</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/admin/orchestration" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Activity className="size-3.5" /> Orchestration</Link>
          <Link to="/admin/costs" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Coins className="size-3.5" /> Costs</Link>
          <Link to="/admin/templates" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Store className="size-3.5" /> Templates</Link>
          <Link to="/admin/models" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Radar className="size-3.5" /> Model Watch</Link>
          <Link to="/admin/workflows" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><BookOpen className="size-3.5" /> Guides</Link>
           <Link to="/admin/site-map" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><BookOpen className="size-3.5" /> Site map</Link>
          <Link to="/admin/smoke" className="text-sm text-muted-foreground hover:text-foreground">Smoke test</Link>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">My dashboard</Link>
          <Link to="/studio" className="text-sm text-muted-foreground hover:text-foreground">Studio</Link>
          <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>Sign out</Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Admin overview</h1>
          <p className="text-muted-foreground mt-1">Every user. Every generation. Every payment.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon={Users} label="Users" value={s?.totalUsers ?? "—"} />
          <Stat icon={ImagePlay} label="Generations" value={s?.totalGens ?? "—"} sub={`${s?.totalImages ?? 0} img · ${s?.totalVideos ?? 0} vid`} />
          <Stat icon={DollarSign} label="Revenue (USD)" value={s ? `$${s.totalRevenueUsd.toFixed(2)}` : "—"} />
          <Stat icon={Coins} label={`Margin (${PROFIT_SPLIT_PCT}%)`} value={s ? `$${(s.totalRevenueUsd * (PROFIT_SPLIT_PCT / 100)).toFixed(2)}` : "—"} />
        </div>

        <SchedulerBanner
          scheduler={data?.scheduler ?? null}
          queue={data?.queue ?? null}
          stuckReservations={data?.stuckReservations ?? null}
        />

        <GenerationHealthBanner rows={genHealth ?? []} />

        {/* Grant credits */}
        <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Grant Aura</h2>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="user_id (uuid)" value={grantUser} onChange={(e) => setGrantUser(e.target.value)} className="flex-1 min-w-[260px]" />
            <Input type="number" value={grantAmount} onChange={(e) => setGrantAmount(parseInt(e.target.value || "0"))} className="w-32" />
            <Button onClick={() => grantMut.mutate()} disabled={!grantUser || grantMut.isPending}>{grantMut.isPending ? "…" : "Grant"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Tip: copy a user_id from the Users tab below.</p>
        </section>

        {/* Feature Vault — archived features, reachable from here */}
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium uppercase tracking-wider text-amber-400">Feature Vault</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">archived · hidden from nav</span>
          </div>
          <p className="text-xs text-muted-foreground">Open a creation workspace that is ready to use now. Operational dashboards remain in the admin navigation above.</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { to: "/motion",           label: "Perform Anywhere" },
              { to: "/colors",           label: "Colors Studio" },
              { to: "/avatar",           label: "Avatar Studio" },
              { to: "/avatar", search: { tab: "script" }, label: "AI Scripts" },
              { to: "/avatar", search: { tab: "avatars" }, label: "My Avatars" },
              { to: "/avatar", search: { tab: "shots" }, label: "Avatar Shots" },
              { to: "/content-machine",  label: "Content Machine" },
              { to: "/tiktok",           label: "TikTok Studio" },
              { to: "/edit",             label: "AutoCut" },
              { to: "/lipsync",          label: "Lip Sync Studio" },
              { to: "/music-video",      label: "Music Video Studio" },
              { to: "/spin",             label: "TikTok30 Factory" },
            ] as const).map((f) => (
              <Link
                key={f.to}
                to={f.to}
                search={"search" in f ? f.search : undefined}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card/40 hover:border-primary/50 hover:bg-card transition-colors text-sm text-muted-foreground hover:text-foreground no-underline"
              >
                <span className="size-1.5 rounded-full bg-amber-400/60 shrink-0" />
                {f.label}
              </Link>
            ))}
          </div>
          {/* Separate app, not a route in this bundle — owner-only, gated on the
              admin role inside the artifact itself, so it needs a plain link. */}
          <a
            href="/aurora-adult/"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:border-primary/50 transition-colors text-sm text-muted-foreground hover:text-foreground no-underline"
          >
            <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />
            Adult School
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-background/60 border border-border text-muted-foreground">18+</span>
          </a>
        </section>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border overflow-x-auto">
          {(["gens", "users", "payments", "earnings", "workers", "promos", "images", "copy", "router", "resources"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "gens" ? "Generations" : t === "workers" ? "GPU Workers" : t === "promos" ? "Promo Codes" : t === "images" ? "Site Images" : t === "copy" ? "Site Copy" : t === "router" ? "AI Router" : t === "resources" ? "Resources" : t}
            </button>
          ))}
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

        {tab === "gens" && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {(data?.generations ?? []).map((g) => {
              const job = jobsByGen.get(g.id);
              const attempts = job?.attempts ?? 0;
              return (
              <div key={g.id} className="rounded-xl overflow-hidden border border-border bg-card/40">
                <div className="aspect-square bg-background/40">
                  {g.result_image_url ? (
                    <img src={g.result_image_url} alt="" className="w-full h-full object-cover" />
                  ) : g.result_video_url ? (
                    <AutoplayVideo src={g.result_video_url} className="w-full h-full object-cover" autoPlay={false} playsInline />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground p-2 text-center">{g.status}{g.error ? `: ${g.error.slice(0, 40)}` : ""}</div>
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <ModelBadge model={g.model} size="xs" />
                    <span className="text-[9px] text-muted-foreground">{new Date(g.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{g.prompt}</p>
                  {attempts > 1 && (
                    <p className="text-[9px] text-amber-500" title={job?.error ?? undefined}>
                      attempt {attempts}{job?.status === "queued" ? " · retrying" : job?.status === "processing" ? " · running" : ""}
                    </p>
                  )}
                  <p className="text-[9px] text-muted-foreground/60 truncate" title={g.user_id}>{g.user_id.slice(0, 8)}…</p>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {tab === "users" && (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left p-3">Email</th><th className="text-left p-3">Name</th><th className="text-right p-3">Aura</th><th className="text-right p-3">Spent</th><th className="text-left p-3">User ID</th></tr>
              </thead>
              <tbody>
                {(data?.users ?? []).map((u) => (
                  <tr key={u.user_id} className="border-t border-border hover:bg-card/40">
                    <td className="p-3">{u.email ?? "—"}</td>
                    <td className="p-3">{u.display_name ?? "—"}</td>
                    <td className="p-3 text-right">{u.credits}</td>
                    <td className="p-3 text-right">{u.lifetime_credits_purchased}</td>
                    <td className="p-3"><button onClick={() => { setGrantUser(u.user_id); navigator.clipboard.writeText(u.user_id); toast.success("Copied"); }} className="text-xs text-muted-foreground hover:text-foreground">{u.user_id.slice(0, 12)}…</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "payments" && (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left p-3">When</th><th className="text-left p-3">Reference</th><th className="text-right p-3">Amount</th><th className="text-right p-3">Aura</th><th className="text-left p-3">Status</th></tr>
              </thead>
              <tbody>
                {(data?.payments ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3 text-xs">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="p-3 text-xs">{p.reference}</td>
                    <td className="p-3 text-right">{p.currency} {(p.amount_kobo / 100).toFixed(2)}</td>
                    <td className="p-3 text-right">{p.credits_granted}</td>
                    <td className={`p-3 text-xs ${p.status === "succeeded" ? "text-emerald-500" : "text-muted-foreground"}`}>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === "earnings" && <EarningsPanel />}
        {tab === "workers" && <WorkersPanel />}
        {tab === "promos" && <PromosPanel />}
        {tab === "images" && <ImagesPanel />}
        {tab === "copy" && <CopyPanel />}
        {tab === "router" && <RouterPanel />}
        {tab === "resources" && <ResourcesPanel />}
      </div>
    </main>
  );
}

const EARNINGS_RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
] as const;
type EarningsRangeValue = (typeof EARNINGS_RANGES)[number]["value"];

function EarningsPanel() {
  const earningsFn = useServerFn(adminEarnings);
  const [range, setRange] = useState<EarningsRangeValue>("30d");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-earnings", range],
    queryFn: () => earningsFn({ data: { range } }),
    refetchInterval: 30_000,
  });

  const t = data?.totals;
  const usd = (n: number | undefined) => (n == null ? "—" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Owner earnings</h2>
        <div className="flex gap-1 rounded-full border border-border bg-card/40 p-1">
          {EARNINGS_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${range === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={DollarSign} label="Revenue" value={usd(t?.revenueUsd)} sub={`${t?.transactions ?? 0} purchases`} />
        <Stat icon={TrendingUp} label={`Profit (${data?.profitPct ?? PROFIT_SPLIT_PCT}%)`} value={usd(t?.profitUsd)} sub="Your earnings" />
        <Stat icon={Coins} label={`Credit funding (${data?.creditFundingPct ?? 100 - PROFIT_SPLIT_PCT}%)`} value={usd(t?.creditFundingUsd)} sub="Funds generations" />
        <Stat icon={Gift} label="Aura distributed" value={t ? t.creditsDistributed.toLocaleString() : "—"} sub="Granted to customers" />
      </div>

      {/* Split breakdown bar */}
      {data && (
        <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Payment split</h3>
          <div className="flex h-8 rounded-lg overflow-hidden">
            <div className="flex items-center justify-center text-xs font-medium text-primary-foreground" style={{ width: `${data.profitPct}%`, background: "var(--gradient-hero)" }}>
              {data.profitPct}% profit
            </div>
            <div className="flex items-center justify-center text-xs font-medium bg-muted text-muted-foreground" style={{ width: `${data.creditFundingPct}%` }}>
              {data.creditFundingPct}% credits
            </div>
          </div>
        </section>
      )}

      {/* Revenue/profit trend */}
      <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Trend</h3>
          {data?.series && (
            <span className="text-xs text-muted-foreground capitalize">by {data.series.granularity}</span>
          )}
        </div>
        {data && data.series.points.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                  width={48}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name === "revenueUsd" ? "Revenue" : "Profit"]}
                  labelFormatter={(label: string) => label}
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenueUsd" stroke="var(--primary)" strokeWidth={2} fill="url(#revenueFill)" />
                <Area type="monotone" dataKey="profitUsd" stroke="#10b981" strokeWidth={2} fill="url(#profitFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {isLoading ? "Loading…" : "No purchases in this range yet."}
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">Recent customers</h3>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-right p-3">Paid</th>
                <th className="text-right p-3">Profit</th>
                <th className="text-right p-3">Aura</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentPurchases ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-card/40">
                  <td className="p-3 text-xs">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="p-3">
                    <div>{p.email ?? "—"}</div>
                    {p.display_name && <div className="text-xs text-muted-foreground">{p.display_name}</div>}
                  </td>
                  <td className="p-3 text-right">{p.currency} {(p.amount_minor / 100).toFixed(2)}</td>
                  <td className="p-3 text-right text-emerald-500">${(p.profit_minor / 100).toFixed(2)}</td>
                  <td className="p-3 text-right">{p.credits_granted}</td>
                </tr>
              ))}
              {!isLoading && (data?.recentPurchases ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-sm">No purchases in this range yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="text-sm text-muted-foreground mt-2">Loading…</div>}
      </section>

      <WithdrawalsPanel />
    </div>
  );
}

// All-time profit vs. what the owner has actually withdrawn from the
// business. Independent of the range selector above — a payout is recorded
// against the whole accumulated pool, not a date slice of it.
function WithdrawalsPanel() {
  const summaryFn = useServerFn(adminWithdrawalSummary);
  const recordFn = useServerFn(adminRecordWithdrawal);
  const checkFn = useServerFn(adminCheckWithdrawalAmount);
  const updateFn = useServerFn(adminUpdateWithdrawal);
  const deleteFn = useServerFn(adminDeleteWithdrawal);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: () => summaryFn(),
  });
  const todayLocal = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [withdrawnDate, setWithdrawnDate] = useState(todayLocal);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDate, setEditDate] = useState("");

  const toIsoAtNoon = (dateStr: string) => new Date(`${dateStr}T12:00:00`).toISOString();
  const toDateInputValue = (isoDate: string) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return todayLocal();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const recordMut = useMutation({
    mutationFn: async () => {
      const amountUsd = parseFloat(amount);
      if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error("Enter a valid amount");
      // Warn before recording a payout larger than what's actually left,
      // rather than silently pushing "remaining" negative — the owner may
      // still confirm (e.g. a legitimate backdated correction).
      const check = await checkFn({ data: { amountUsd } });
      if (check.exceedsRemaining) {
        const proceed = window.confirm(
          `This payout ($${amountUsd.toFixed(2)}) exceeds the remaining balance ($${check.remainingUsd.toFixed(2)}). Record it anyway?`,
        );
        if (!proceed) throw new Error("__cancelled__");
      }
      // Date-only input from the browser (YYYY-MM-DD); anchor to local
      // midday before converting to ISO so the recorded date doesn't shift a
      // day when serialized to UTC in timezones behind UTC.
      const withdrawnAt = withdrawnDate ? toIsoAtNoon(withdrawnDate) : undefined;
      return recordFn({ data: { amountUsd, note: note.trim() || undefined, withdrawnAt } });
    },
    onSuccess: () => {
      toast.success("Payout recorded");
      setAmount("");
      setNote("");
      setWithdrawnDate(todayLocal());
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e) => {
      if (e instanceof Error && e.message === "__cancelled__") return;
      toast.error(e instanceof Error ? e.message : "Failed to record payout");
    },
  });

  const editMut = useMutation({
    mutationFn: async (id: string) => {
      const amountUsd = parseFloat(editAmount);
      if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new Error("Enter a valid amount");
      if (!editDate) throw new Error("Choose a payout date");
      return updateFn({
        data: {
          id,
          amountUsd,
          note: editNote.trim() || undefined,
          withdrawnAt: toIsoAtNoon(editDate),
        },
      });
    },
    onSuccess: () => {
      toast.success("Payout updated");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to update payout"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Payout removed");
      qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove payout"),
  });

  const usd = (n: number | undefined) => (n == null ? "—" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
        <Wallet className="size-4" /> Owner payouts (all-time)
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={TrendingUp} label="Total profit" value={usd(data?.totalProfitUsd)} sub="Accumulated since day one" />
        <Stat icon={Wallet} label="Total withdrawn" value={usd(data?.totalWithdrawnUsd)} sub="Already paid out" />
        <Stat
          icon={DollarSign}
          label="Remaining to withdraw"
          value={usd(data?.remainingUsd)}
          sub={(data?.remainingUsd ?? 0) < 0 ? "Withdrawn more than recorded profit" : "Still in the business"}
        />
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          recordMut.mutate();
        }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Amount (USD)</label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Date</label>
          <Input
            type="date"
            value={withdrawnDate}
            max={todayLocal()}
            onChange={(e) => setWithdrawnDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label className="text-xs text-muted-foreground">Note (optional)</label>
          <Input placeholder="e.g. Transferred to personal account" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <Button type="submit" disabled={recordMut.isPending || !amount}>
          {recordMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Record payout"}
        </Button>
      </form>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">When</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-left p-3">Note</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.withdrawals ?? []).map((w) =>
              editingId === w.id ? (
                <tr key={w.id} className="border-t border-border bg-card/30">
                  <td className="p-3">
                    <Input
                      type="date"
                      value={editDate}
                      max={todayLocal()}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-40"
                      aria-label="Payout date"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-28 ml-auto"
                    />
                  </td>
                  <td className="p-3">
                    <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Note (optional)" />
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={editMut.isPending}
                      onClick={() => editMut.mutate(w.id)}
                    >
                      {editMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={w.id} className="border-t border-border">
                  <td className="p-3 text-xs">{new Date(w.withdrawnAt).toLocaleString()}</td>
                  <td className="p-3 text-right">{usd(w.amountUsd)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{w.note ?? "—"}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(w.id);
                        setEditAmount(String(w.amountUsd));
                        setEditNote(w.note ?? "");
                        setEditDate(toDateInputValue(w.withdrawnAt));
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (window.confirm("Remove this payout entry? This cannot be undone.")) {
                          deleteMut.mutate(w.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ),
            )}
            {!isLoading && (data?.withdrawals ?? []).length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">No payouts recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {isLoading && <div className="text-sm text-muted-foreground mt-2">Loading…</div>}
    </section>
  );
}

function heartbeatAge(ts: string | null | undefined): string {
  if (!ts) return "never";
  const ageMs = Date.now() - new Date(ts).getTime();
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s ago`;
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}m ago`;
  return `${Math.round(ageMs / 3_600_000)}h ago`;
}

// Health of the external cron that drives the job queue (records a heartbeat each
// tick). If no tick has landed recently the scheduler is likely stalled and
// retries won't make progress until it's restored.
function SchedulerBanner({
  scheduler,
  queue,
  stuckReservations,
}: {
  scheduler: { last_run_at: string | null; last_ok_at: string | null; last_error: string | null } | null;
  queue: { queued: number; processing: number; failed: number; retrying: number } | null;
  stuckReservations?: { count: number } | null;
}) {
  const lastRun = scheduler?.last_run_at ?? null;
  const ageMs = lastRun ? Date.now() - new Date(lastRun).getTime() : Infinity;
  const stale = ageMs > 5 * 60_000; // no tick in 5 min ⇒ scheduler likely stalled
  const hasError = !!scheduler?.last_error;
  const stuckCount = stuckReservations?.count ?? 0;
  const hasStuck = stuckCount > 0;
  const healthy = !!lastRun && !stale && !hasError && !hasStuck;
  return (
    <section
      className={`rounded-2xl border p-5 space-y-2 ${healthy ? "border-border bg-card/40" : "border-amber-500/40 bg-amber-500/10"}`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Activity className="size-4" /> Job scheduler
        </h2>
        <span className={`text-xs ${healthy ? "text-emerald-500" : "text-amber-500"}`}>
          {!lastRun
            ? "Never run — cron not wired"
            : stale
              ? `Stalled · last tick ${heartbeatAge(lastRun)}`
              : `Healthy · last tick ${heartbeatAge(lastRun)}`}
        </span>
      </div>
      {hasError && (
        <p className="text-xs text-amber-500 break-all">Last error: {scheduler?.last_error}</p>
      )}
      {queue && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>Queued: <b className="text-foreground">{queue.queued}</b></span>
          <span>Processing: <b className="text-foreground">{queue.processing}</b></span>
          <span>Retrying: <b className="text-foreground">{queue.retrying}</b></span>
          <span>Failed: <b className="text-foreground">{queue.failed}</b></span>
        </div>
      )}
      {hasStuck && (
        // Task #95: jobs finished terminal but their reservation hasn't been
        // committed/released yet. The tick's sweepStuckReservations self-heals
        // these every run — a persistently nonzero count means the scheduler
        // itself isn't ticking (see the banner above) rather than a new leak.
        <p className="text-xs text-amber-500">
          ⚠ {stuckCount} job{stuckCount === 1 ? "" : "s"} with an unsettled credit reservation — the
          next scheduler tick will reconcile {stuckCount === 1 ? "it" : "them"} automatically.
        </p>
      )}
    </section>
  );
}

// ─── Generation Health Banner ─────────────────────────────────────────────────
// Shows a red alert panel when any monitored generation kind (image / video /
// lipsync / audio / motion) is currently degraded according to the last
// provider-health-check cron run.  Disappears when all kinds are healthy or
// the cron hasn't run yet (no data = no false alarm).
function GenerationHealthBanner({ rows }: { rows: GenerationHealthRow[] }) {
  // A kind is "alerting" when an alert has been sent but no recovery yet.
  const degraded = rows.filter(
    (r) =>
      r.alert_sent_at !== null &&
      (r.recovery_sent_at === null || r.alert_sent_at > r.recovery_sent_at),
  );

  if (degraded.length === 0) return null;

  return (
    <section className="rounded-2xl border border-red-500/50 bg-red-500/10 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <XCircle className="size-5 text-red-400 shrink-0" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-red-400">
          Generation outage detected
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        The automated health monitor has detected that one or more generation kinds are failing.
        An alert email has been sent. Check provider_logs or the Orchestration panel to
        investigate.
      </p>
      <div className="flex flex-wrap gap-3">
        {degraded.map((r) => (
          <div
            key={r.kind}
            className="rounded-lg border border-red-500/30 bg-red-500/15 px-4 py-2 text-xs space-y-1"
          >
            <div className="font-semibold text-red-300 uppercase tracking-wide">{r.kind}</div>
            {r.last_error_summary && (
              <div className="text-red-400/80 break-all">{r.last_error_summary}</div>
            )}
            {r.alert_sent_at && (
              <div className="text-muted-foreground">
                Alerted: {new Date(r.alert_sent_at).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        This banner clears automatically after the next successful check confirms recovery.
      </p>
    </section>
  );
}

type WorkerProtocol = "custom" | "runpod" | "comfyui" | "hfspace" | "vast";

// Per-platform connect recipes shown in the Register panel. These point at the
// ready-to-run templates in the repo `workers/` dir (LatentSync = lipsync,
// MimicMotion = motion) so an operator can stand a worker up end-to-end.
const WORKER_RECIPES: Record<WorkerProtocol, {
  label: string; template: string; endpoint: string; caps: string; steps: string[];
}> = {
  custom: {
    label: "Custom — self-hosted FastAPI (GPU VM / Colab)",
    template: "workers/aurora_worker.py",
    endpoint: "https://<host>:8000/generate",
    caps: "lipsync,motion",
    steps: [
      "Run workers/setup.sh to clone LatentSync + MimicMotion and fetch weights (~24GB, 24GB-VRAM GPU).",
      "Start it: uvicorn aurora_worker:app --host 0.0.0.0 --port 8000 --app-dir workers",
      "Expose the port (or use the Colab/Kaggle tunnel) and paste the …/generate URL above.",
      "Optional: set AURORA_WORKER_TOKEN on the box and the same value as the Auth bearer token here.",
    ],
  },
  vast: {
    label: "Vast.ai — rented GPU box (same /generate contract)",
    template: "workers/aurora_worker.py",
    endpoint: "https://<vast-host>:<port>/generate",
    caps: "lipsync,motion",
    steps: [
      "Rent a 24GB+ GPU instance and open an external port.",
      "Run workers/setup.sh, then start aurora_worker:app on that port.",
      "Register the instance's public …/generate URL above.",
    ],
  },
  runpod: {
    label: "RunPod Serverless",
    template: "workers/runpod/ (Dockerfile + handler.py)",
    endpoint: "https://api.runpod.ai/v2/<endpoint-id>",
    caps: "lipsync,motion",
    steps: [
      "docker build -f workers/runpod/Dockerfile -t <you>/aurora-worker workers && push it.",
      "Create a Serverless endpoint (24GB+ GPU, ≥40GB disk) from that image.",
      "Set the Auth bearer token to your RunPod API key.",
      "Tick the /runsync box below for short clips; leave off to poll /status.",
    ],
  },
  comfyui: {
    label: "ComfyUI — free-GPU swarm (Aurora ships the graphs)",
    template: "workers/kaggle/ + workers/comfyui/ (image, video, lipsync, motion graphs)",
    endpoint: "https://<host>:8188",
    caps: "image,video,lipsync,motion",
    steps: [
      "Run the Kaggle or Colab ComfyUI launcher (workers/kaggle/) — it installs ComfyUI + the node packs and auto-registers on boot.",
      "Or run it yourself: python main.py --listen 0.0.0.0 --port 8188, then register the …:8188 URL above.",
      "Aurora sends the prompt graph (SDXL image, SVD/AnimateDiff video, LatentSync, MimicMotion) — keep node class names matching workers/comfyui/*.json.",
      "Advertise only the capabilities your VRAM can serve: 16GB → lipsync/image; 24GB+ → add video/motion.",
    ],
  },
  hfspace: {
    label: "Hugging Face Space — one task per Space",
    template: "workers/hf-space/ (Gradio app.py)",
    endpoint: "https://<user>-<space>.hf.space",
    caps: "lipsync  OR  motion",
    steps: [
      "Create a Gradio Space (GPU) with app.py + aurora_worker.py + setup.sh.",
      "Set AURORA_TASK=lipsync or AURORA_TASK=motion (Gradio is arity-locked to one task).",
      "Register with the MATCHING capability; add an HF token only if the Space is private.",
    ],
  },
};

function PromosPanel() {
  const listFn = useServerFn(listPromoCodes);
  const issueFn = useServerFn(issuePromoCode);
  const toggleFn = useServerFn(setPromoCodeActive);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["promo-codes"], queryFn: () => listFn() });

  const blank = {
    kind: "discount" as "discount" | "bonus",
    percentOff: 10,
    bonusCredits: 20,
    maxRedemptions: "" as string | number,
    expiresAt: "",
    note: "",
    code: "",
  };
  const [form, setForm] = useState(blank);

  const issueMut = useMutation({
    mutationFn: () =>
      issueFn({
        data: {
          kind: form.kind,
          ...(form.kind === "discount" ? { percentOff: form.percentOff } : { bonusCredits: form.bonusCredits }),
          ...(form.maxRedemptions !== "" ? { maxRedemptions: Number(form.maxRedemptions) } : {}),
          ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
          ...(form.note.trim() ? { note: form.note.trim() } : {}),
          ...(form.code.trim() ? { code: form.code.trim() } : {}),
        },
      }),
    onSuccess: (row) => {
      toast.success(`Promo code ${row.code} created`);
      setForm(blank);
      qc.invalidateQueries({ queryKey: ["promo-codes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create promo code"),
  });

  const toggleMut = useMutation({
    mutationFn: (row: PromoCodeRow) => toggleFn({ data: { id: row.id, active: !row.active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promo-codes"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Tag className="size-4" /> Issue promo code
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as "discount" | "bonus" })}
          >
            <option value="discount">Discount — % off at checkout</option>
            <option value="bonus">Bonus — flat Aura on redeem</option>
          </select>
          <Input placeholder="Custom code (optional, auto-generated otherwise)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          {form.kind === "discount" ? (
            <Input type="number" placeholder="Percent off (1-100)" value={form.percentOff} onChange={(e) => setForm({ ...form, percentOff: parseInt(e.target.value || "0") })} />
          ) : (
            <Input type="number" placeholder="Bonus Aura credits" value={form.bonusCredits} onChange={(e) => setForm({ ...form, bonusCredits: parseInt(e.target.value || "0") })} />
          )}
          <Input type="number" placeholder="Max redemptions (optional)" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />
          <Input type="datetime-local" placeholder="Expires at (optional)" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          <Input placeholder="Note (internal, optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
        <Button onClick={() => issueMut.mutate()} disabled={issueMut.isPending}>
          {issueMut.isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : <Tag className="size-4 mr-1" />}
          Create code
        </Button>
      </section>

      <section className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Code</th>
              <th className="text-left p-3">Kind</th>
              <th className="text-right p-3">Value</th>
              <th className="text-right p-3">Redemptions</th>
              <th className="text-left p-3">Expires</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-card/40">
                <td className="p-3">
                  <button
                    onClick={() => { navigator.clipboard.writeText(p.code); toast.success("Copied"); }}
                    className="text-xs inline-flex items-center gap-1 hover:text-foreground text-muted-foreground"
                  >
                    {p.code} <Copy className="size-3" />
                  </button>
                </td>
                <td className="p-3 capitalize">{p.kind}</td>
                <td className="p-3 text-right">{p.kind === "discount" ? `${p.percent_off}%` : `${p.bonus_credits} Aura`}</td>
                <td className="p-3 text-right">{p.redemption_count}{p.max_redemptions != null ? ` / ${p.max_redemptions}` : ""}</td>
                <td className="p-3 text-xs">{p.expires_at ? new Date(p.expires_at).toLocaleDateString() : "—"}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.active ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                    {p.active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => toggleMut.mutate(p)} disabled={toggleMut.isPending}>
                    {p.active ? "Disable" : "Enable"}
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && (data ?? []).length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground text-sm">No promo codes yet.</td></tr>
            )}
          </tbody>
        </table>
        {isLoading && <div className="text-sm text-muted-foreground p-3">Loading…</div>}
      </section>
    </div>
  );
}

function WorkersPanel() {
  const listFn = useServerFn(listWorkers);
  const saveFn = useServerFn(upsertWorker);
  const delFn = useServerFn(deleteWorker);
  const pingFn = useServerFn(pingWorker);
  const statusFn = useServerFn(setWorkerStatus);
  const freeModeFn = useServerFn(getFreeGpuMode);
  const setFreeModeFn = useServerFn(setFreeGpuMode);
  const approveFn = useServerFn(approveWorker);
  const rejectFn = useServerFn(rejectWorker);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["workers"], queryFn: () => listFn() });
  const { data: freeMode } = useQuery({ queryKey: ["free-gpu-mode"], queryFn: () => freeModeFn() });
  const freeModeMut = useMutation({
    mutationFn: async (enabled: boolean) => setFreeModeFn({ data: { enabled } }),
    onSuccess: (r) => {
      toast.success(r.enabled ? "Free GPU only mode ON — paid providers disabled" : "Free GPU only mode OFF — paid fallback enabled");
      qc.invalidateQueries({ queryKey: ["free-gpu-mode"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const approveMut = useMutation({
    mutationFn: (id: string) => approveFn({ data: { id } }),
    onSuccess: () => { toast.success("Worker approved — now active and serving jobs"); qc.invalidateQueries({ queryKey: ["workers"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Approve failed"),
  });
  const rejectMut = useMutation({
    mutationFn: (id: string) => rejectFn({ data: { id } }),
    onSuccess: () => { toast.success("Worker rejected — set to paused"); qc.invalidateQueries({ queryKey: ["workers"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Reject failed"),
  });
  const blank = { 
    name: "", endpoint_url: "", auth_token: "", region: "global", 
    capabilities: "image,video", priority: 100, max_concurrency: 4, 
    protocol: "custom" as WorkerProtocol, 
    worker_role: "" as string, 
    runpod_sync: false 
  };
  const [form, setForm] = useState(blank);
  const reset = () => setForm(blank);
  return (
    <div className="space-y-6">
      <section className={`rounded-2xl border p-5 space-y-2 ${freeMode?.enabled ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card/40"}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className={`size-4 ${freeMode?.enabled ? "text-emerald-500" : "text-muted-foreground"}`} />
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Free GPU only mode</h2>
          </div>
          <Button
            size="sm"
            variant={freeMode?.enabled ? "default" : "outline"}
            disabled={!freeMode || freeModeMut.isPending}
            onClick={() => freeModeMut.mutate(!freeMode?.enabled)}
          >
            {freeModeMut.isPending ? <Loader2 className="size-4 animate-spin" /> : freeMode?.enabled ? "ON — turn off" : "OFF — turn on"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {freeMode?.enabled
            ? "Generations run ONLY on your self-hosted GPU workers plus free ($0) providers (e.g. Pollinations). All paid APIs (Replicate, Kling, HeyGen, Fal, Runway, Lovable, ElevenLabs) are skipped — they can never bill. If no free worker is online for video/lip-sync/motion, the request fails fast with no spend."
            : "Off — self-hosted GPU is preferred first, with paid APIs as automatic fallback (today's behavior). Turn on to guarantee no paid spend."}
          {freeMode ? ` Default from FREE_GPU_ONLY env: ${freeMode.envDefault ? "on" : "off"}.` : ""}
        </p>
      </section>
      <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Server className="size-4" /> Register GPU worker</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input placeholder="Name (e.g. runpod-a100-eu)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Endpoint URL (https://…)" value={form.endpoint_url} onChange={e => setForm({ ...form, endpoint_url: e.target.value })} />
          <Input placeholder="Auth bearer token (optional)" value={form.auth_token} onChange={e => setForm({ ...form, auth_token: e.target.value })} />
          <Input placeholder="Region" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} />
          <Input placeholder="Capabilities (comma: image,video,lipsync,motion,upscale)" value={form.capabilities} onChange={e => setForm({ ...form, capabilities: e.target.value })} />
          <Input type="number" placeholder="Max concurrency" value={form.max_concurrency} onChange={e => setForm({ ...form, max_concurrency: parseInt(e.target.value || "4") })} />
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
            value={form.protocol} 
            onChange={e => setForm({ ...form, protocol: e.target.value as WorkerProtocol })}
          >
            <option value="custom">Protocol: Custom — Colab / ngrok / self-hosted (POST /generate)</option>
            <option value="vast">Protocol: Vast.ai — self-hosted HTTP (POST /generate)</option>
            <option value="runpod">Protocol: RunPod (/runsync or /run)</option>
            <option value="comfyui">Protocol: ComfyUI (/prompt + /history)</option>
            <option value="hfspace">Protocol: HF Space — Gradio (/gradio_api)</option>
          </select>
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
            value={form.worker_role} 
            onChange={e => setForm({ ...form, worker_role: e.target.value })}
          >
            <option value="">Role: (auto from capabilities)</option>
            <option value="comfyui">comfyui — image / upscale</option>
            <option value="kling">kling — video</option>
            <option value="lipsync">lipsync</option>
            <option value="motion">motion — video</option>
          </select>
          {form.protocol === "runpod" && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
              <input type="checkbox" checked={form.runpod_sync} onChange={e => setForm({ ...form, runpod_sync: e.target.checked })} />
              Use <code>/runsync</code> (synchronous) instead of <code>/run</code> + poll
            </label>
          )}
        </div>
        <Button onClick={async () => {
          await saveFn({ data: {
            name: form.name, endpoint_url: form.endpoint_url, auth_token: form.auth_token || null,
            region: form.region, capabilities: form.capabilities.split(",").map(s => s.trim()).filter(Boolean),
            models: [], priority: form.priority, max_concurrency: form.max_concurrency, status: "active",
            protocol: form.protocol, worker_role: form.worker_role || null, runpod_sync: form.runpod_sync,
          } });
          toast.success("Worker added"); reset(); qc.invalidateQueries({ queryKey: ["workers"] });
        }} disabled={!form.name || !form.endpoint_url}>Add worker</Button>
        {(() => {
          const r = WORKER_RECIPES[form.protocol];
          return (
            <div className="rounded-lg border border-border bg-background/40 p-3 text-xs space-y-2">
              <p className="font-medium text-foreground">{r.label} — connect recipe</p>
              <div className="grid sm:grid-cols-3 gap-1">
                <p>Template: <code>{r.template}</code></p>
                <p>Endpoint: <code>{r.endpoint}</code></p>
                <p>Capabilities: <code>{r.caps}</code></p>
              </div>
              <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
                {r.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              <p className="text-muted-foreground">
                <strong>lipsync</strong> (LatentSync) and <strong>motion</strong> (MimicMotion) are
                self-hosted only — there is no hosted fallback, so a worker with these capabilities
                must be online for those features. Set <strong>Role</strong> to override the task
                inferred from capabilities. See <code>workers/CONTRACT.md</code> for the full job contract.
              </p>
            </div>
          );
        })()}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Custom / Vast.ai:</strong> <code>POST /generate</code> with flat JSON body → <code>{"{ url }"}</code>. Health: <code>GET /health</code>. Use this for Colab+ngrok, a Vast.ai box, or any self-hosted server.</p>
          <p><strong>RunPod:</strong> <code>POST /runsync</code> (preferred) or <code>POST /run</code> + <code>{"GET /status/{id}"}</code> with body <code>{"{ input: { kind, prompt, image_urls, audio_url, video_url, model, duration, resolution } }"}</code>. Auth token sent as <code>Authorization: Bearer …</code>.</p>
          <p><strong>ComfyUI:</strong> raw ComfyUI server — <code>POST /prompt</code> with a workflow graph, poll <code>{"/history/{id}"}</code>, fetch <code>/view</code>. Health: <code>GET /system_stats</code>. Aurora ships the image (SDXL), video (SVD/AnimateDiff), LatentSync &amp; MimicMotion graphs — a free-GPU Kaggle/Colab swarm serves image/video first, with hosted providers as fallback.</p>
          <p><strong>HF Space:</strong> a Gradio Space — calls <code>{"/gradio_api/call/predict"}</code> over SSE. Health: <code>GET /</code>. One Space serves one task.</p>
          <p>Lower <strong>priority</strong> number = tried first. Use higher priority (e.g. 200) for serverless/auto-scale fallback workers.</p>
        </div>
      </section>
      {(() => {
        const workers = data?.workers ?? [];
        if (workers.length === 0) return null;
        // Live fleet capacity, aggregated per capability. "Online" = active status
        // and a heartbeat within the 5-min liveness window (matches the orchestrator's
        // staleness cutoff). Free idle slots = max_concurrency − in_flight on those.
        const caps = ["image", "video", "lipsync", "motion", "upscale"] as const;
        const summary = caps.map(cap => {
          const matching = workers.filter(w => (w.capabilities ?? []).includes(cap));
          const online = matching.filter(w => {
            const fresh = w.last_heartbeat ? Date.now() - new Date(w.last_heartbeat).getTime() < 5 * 60_000 : false;
            return w.status === "active" && fresh;
          });
          const free = online.reduce((n, w) => n + Math.max(0, (w.max_concurrency ?? 0) - (w.in_flight ?? 0)), 0);
          const selfHostedOnly = cap === "lipsync" || cap === "motion";
          return { cap, total: matching.length, online: online.length, free, selfHostedOnly };
        });
        return (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {summary.map(s => (
              <div key={s.cap} className="rounded-xl border border-border bg-card/40 p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.cap}</p>
                <p className={`text-lg font-semibold mt-1 ${s.online > 0 ? "text-emerald-500" : s.selfHostedOnly ? "text-amber-500" : "text-muted-foreground"}`}>
                  {s.online}<span className="text-xs font-normal text-muted-foreground">/{s.total} online</span>
                </p>
                <p className="text-xs text-muted-foreground">{s.free} free slot{s.free === 1 ? "" : "s"}</p>
                {s.selfHostedOnly && s.online === 0 && <p className="text-[11px] text-amber-500 mt-0.5">self-hosted only — offline</p>}
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Pending approval section ───────────────────────────────────────── */}
      {(() => {
        const pending = (data?.workers ?? []).filter(w => w.status === "pending_approval");
        if (pending.length === 0) return null;
        return (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-amber-400" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-amber-400">Pending Approval</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {pending.length} worker{pending.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              These workers self-registered using the Aurora register secret but cannot receive any job until you approve them.
              Review the endpoint URL and capabilities before approving — a bad actor with the register secret could submit a malicious endpoint.
            </p>
            <div className="rounded-xl border border-amber-500/20 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-amber-500/10 text-xs uppercase tracking-wider text-amber-400/70">
                  <tr>
                    <th className="text-left p-3">Name</th>
                    <th className="text-left p-3">Endpoint</th>
                    <th className="text-left p-3">Capabilities</th>
                    <th className="text-left p-3">Protocol</th>
                    <th className="text-left p-3">Registered</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(w => {
                    const protocol = (w as Record<string, unknown>).protocol as string ?? "custom";
                    const createdAt = (w as Record<string, unknown>).created_at as string | null;
                    const busy = approveMut.isPending || rejectMut.isPending;
                    return (
                      <tr key={w.id} className="border-t border-amber-500/10">
                        <td className="p-3 font-medium">{w.name}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          <span className="truncate block max-w-[200px]">{w.endpoint_url}</span>
                        </td>
                        <td className="p-3 text-xs">{(w.capabilities ?? []).join(", ") || "—"}</td>
                        <td className="p-3 text-xs text-muted-foreground">{protocol}</td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {createdAt ? new Date(createdAt).toLocaleString() : heartbeatAge(w.last_heartbeat) + " ago"}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                              disabled={busy}
                              onClick={() => approveMut.mutate(w.id)}
                            >
                              <CheckCircle className="size-3.5 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                              disabled={busy}
                              onClick={() => rejectMut.mutate(w.id)}
                            >
                              <XCircle className="size-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}

      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Endpoint</th>
                <th className="text-left p-3">Caps</th>
                <th className="text-left p-3">Protocol</th>
                <th className="text-right p-3">Load</th>
                <th className="text-left p-3">Heartbeat</th>
                <th className="text-left p-3">Last probe</th>
                <th className="text-left p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(data?.workers ?? []).filter(w => w.status !== "pending_approval").map(w => {
                const staleMs = w.last_heartbeat ? Date.now() - new Date(w.last_heartbeat).getTime() : Infinity;
                const isStale = staleMs > 5 * 60_000;
                const protocol = (w as Record<string, unknown>).protocol as string ?? "custom";
                const role = (w as Record<string, unknown>).worker_role as string | null;
                const runpodSync = (w as Record<string, unknown>).runpod_sync as boolean;
                const lastProbeAt = (w as Record<string, unknown>).last_probe_at as string | null;
                const lastProbeOk = (w as Record<string, unknown>).last_probe_ok as boolean | null;
                const lastProbeDetail = (w as Record<string, unknown>).last_probe_detail as string | null;
                const lastProbeError = (w as Record<string, unknown>).last_probe_error as string | null;
                const pausedReason = (w as Record<string, unknown>).paused_reason as string | null;
                const isPaused = w.status === "paused" || w.status === "draining";
                const pauseLabel =
                  w.status === "draining" ? "draining"
                  : pausedReason === "auto" ? "auto-paused"
                  : pausedReason === "admin" ? "paused (admin)"
                  : "paused";
                return (
                  <tr key={w.id} className="border-t border-border">
                    <td className="p-3">
                      {w.name}
                      {role ? <span className="ml-1 text-xs text-muted-foreground">({role})</span> : null}
                    </td>
                    <td className="p-3 text-xs truncate max-w-[220px]">{w.endpoint_url}</td>
                    <td className="p-3 text-xs">{(w.capabilities ?? []).join(", ")}</td>
                    <td className="p-3 text-xs">{protocol}{protocol === "runpod" && runpodSync ? " · sync" : ""}</td>
                    <td className="p-3 text-right">{w.in_flight}/{w.max_concurrency}</td>
                    <td className={`p-3 text-xs ${isStale ? "text-amber-500" : "text-emerald-500"}`}>
                      {heartbeatAge(w.last_heartbeat)}
                    </td>
                    <td
                      className={`p-3 text-xs ${lastProbeAt == null ? "text-muted-foreground" : lastProbeOk ? "text-emerald-500" : "text-red-500"}`}
                      title={lastProbeError ?? lastProbeDetail ?? undefined}
                    >
                      {lastProbeAt == null ? "never probed" : (
                        <>
                          {heartbeatAge(lastProbeAt)} · {lastProbeOk ? "ok" : "failed"}
                          {(lastProbeError || lastProbeDetail) && (
                            <span className="block truncate max-w-[160px] text-[11px] text-muted-foreground">
                              {lastProbeError ?? lastProbeDetail}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className={`p-3 text-xs ${w.status === "active" ? "text-emerald-500" : "text-muted-foreground"}`}>
                      {isPaused ? pauseLabel : w.status}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={async () => { const r = await pingFn({ data: { id: w.id } }); toast(r.ok ? `OK · ${r.latency_ms}ms${r.detail ? ` · ${r.detail}` : ""}` : `Down: ${r.error ?? r.status}`); qc.invalidateQueries({ queryKey: ["workers"] }); }} title="Health check"><Activity className="size-4" /></Button>
                      {w.status === "active" ? (
                        <Button size="sm" variant="ghost" onClick={async () => { await statusFn({ data: { id: w.id, status: "paused" } }); toast(`Paused ${w.name}`); qc.invalidateQueries({ queryKey: ["workers"] }); }} title="Pause (stop routing new jobs here)"><Pause className="size-4" /></Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={async () => { await statusFn({ data: { id: w.id, status: "active" } }); toast(`Resumed ${w.name}`); qc.invalidateQueries({ queryKey: ["workers"] }); }} title="Resume"><Play className="size-4" /></Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={async () => { if (!confirm("Delete?")) return; await delFn({ data: { id: w.id } }); qc.invalidateQueries({ queryKey: ["workers"] }); }} title="Delete"><Trash2 className="size-4" /></Button>
                    </td>
                  </tr>
                );
              })}
              {(data?.workers ?? []).length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground text-sm">No workers registered. Add your GPU orchestrator endpoint above to enable failover.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <section>
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Recent registration attempts
        </h3>
        <p className="text-xs text-muted-foreground mb-2">
          Every call your Kaggle/Colab/Vast worker made to self-register, success or failure — so a
          bad <code>AURORA_REGISTER_SECRET</code> or misconfigured URL shows up here even when no
          worker row was ever created.
        </p>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-card/60 uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-2">When</th>
                <th className="text-left p-2">Name</th>
                <th className="text-left p-2">Endpoint</th>
                <th className="text-left p-2">Result</th>
                <th className="text-left p-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {(data?.registerAttempts ?? []).map((a: Record<string, unknown>) => (
                <tr key={a.id as string} className="border-t border-border">
                  <td className="p-2">{new Date(a.created_at as string).toLocaleString()}</td>
                  <td className="p-2">{(a.name as string) || "—"}</td>
                  <td className="p-2 truncate max-w-[200px]">{(a.endpoint_url as string) || "—"}</td>
                  <td className={`p-2 ${a.ok ? "text-emerald-500" : "text-red-500"}`}>{a.ok ? (a.outcome as string) || "ok" : "failed"}</td>
                  <td className="p-2 truncate max-w-[300px]" title={(a.error as string) || undefined}>{(a.error as string) || ""}</td>
                </tr>
              ))}
              {(data?.registerAttempts ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">
                  No registration attempts recorded yet — nothing has called /api/public/workers/register.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">Recent worker jobs</h3>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-card/60 uppercase text-muted-foreground"><tr><th className="text-left p-2">When</th><th className="text-left p-2">Kind</th><th className="text-left p-2">Status</th><th className="text-right p-2">ms</th><th className="text-left p-2">Error</th></tr></thead>
            <tbody>{(data?.jobs ?? []).slice(0, 30).map(j => (
              <tr key={j.id} className="border-t border-border"><td className="p-2">{new Date(j.created_at).toLocaleTimeString()}</td><td className="p-2">{j.kind}</td><td className={`p-2 ${j.status === "ok" ? "text-emerald-500" : "text-red-500"}`}>{j.status}</td><td className="p-2 text-right">{j.latency_ms ?? "—"}</td><td className="p-2 truncate max-w-[300px]">{j.error ?? ""}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ImagesPanel() {
  const getSiteImagesFn = useServerFn(getSiteImages);
  const updateFn = useServerFn(adminUpdateSiteImage);
  const resetFn = useServerFn(adminResetSiteImage);
  const qc = useQueryClient();

  const { data: images, isLoading } = useQuery({
    queryKey: ["admin-site-images"],
    queryFn: () => getSiteImagesFn(),
  });

  const [editing, setEditing] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const updateMut = useMutation({
    mutationFn: ({ key, url }: { key: string; url: string }) => updateFn({ data: { key, url } }),
    onSuccess: (_r, { key }) => {
      toast.success("Image updated");
      setEditing((p) => { const n = { ...p }; delete n[key]; return n; });
      qc.invalidateQueries({ queryKey: ["admin-site-images"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const resetMut = useMutation({
    mutationFn: (key: string) => resetFn({ data: { key } }),
    onSuccess: () => { toast.success("Reset to default"); qc.invalidateQueries({ queryKey: ["admin-site-images"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function handleUpload(key: string, file: File) {
    const token = sessionStorage.getItem("aurora_admin_token") ?? "";
    setUploading((p) => ({ ...p, [key]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("key", key);
      const res = await fetch("/api/admin/upload-site-image", {
        method: "POST",
        headers: { "x-aurora-admin": token },
        body: fd,
      });
      const json = await res.json() as { error?: string; url?: string };
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      toast.success("Uploaded & saved");
      qc.invalidateQueries({ queryKey: ["admin-site-images"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading((p) => ({ ...p, [key]: false }));
    }
  }

  const grouped: Record<string, SiteImageRow[]> = {};
  for (const img of images ?? []) {
    (grouped[img.section] ??= []).push(img);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Image className="size-4 text-primary" />
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Site Images</h2>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">landing page</span>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {Object.entries(grouped).map(([section, rows]) => (
        <section key={section} className="space-y-3">
          <h3 className="text-sm font-semibold capitalize text-foreground">{section} images</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {rows.map((img) => {
              const draft = editing[img.key];
              const isUp = uploading[img.key];
              const isCustom = img.url !== img.default_url;
              return (
                <div key={img.key} className="rounded-xl border border-border bg-card/40 overflow-hidden space-y-2 p-2">
                  <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-background/40">
                    <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                    {isCustom && (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold uppercase tracking-wide">custom</span>
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-foreground truncate">{img.label}</p>
                  <p className="text-[9px] text-muted-foreground">{img.key}</p>
                  {draft !== undefined ? (
                    <div className="space-y-1">
                      <input
                        type="url"
                        value={draft}
                        onChange={(e) => setEditing((p) => ({ ...p, [img.key]: e.target.value }))}
                        placeholder="https://…"
                        className="w-full text-[10px] px-2 py-1 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                      />
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateMut.mutate({ key: img.key, url: draft.trim() })}
                          disabled={!draft.trim() || updateMut.isPending}
                          className="flex-1 text-[10px] py-1 rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing((p) => { const n = { ...p }; delete n[img.key]; return n; })}
                          className="text-[10px] px-2 py-1 rounded-md border border-border text-muted-foreground"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing((p) => ({ ...p, [img.key]: img.url }))}
                        className="text-[10px] py-1 rounded-md border border-border text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                      >
                        Change URL
                      </button>
                      <label className={`text-[10px] py-1 rounded-md border border-dashed border-border text-center transition-colors ${isUp ? "opacity-50 cursor-wait" : "cursor-pointer text-muted-foreground hover:border-primary hover:text-foreground"}`}>
                        {isUp ? "Uploading…" : "Upload file"}
                        <input
                          type="file"
                          accept="image/*"
                          className="sr-only"
                          disabled={!!isUp}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleUpload(img.key, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => resetMut.mutate(img.key)}
                          disabled={resetMut.isPending}
                          className="text-[9px] py-0.5 rounded text-rose-400/70 hover:text-rose-400 transition-colors"
                        >
                          ↺ Reset to default
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Site Copy panel ──────────────────────────────────────────────────────────
function CopyPanel() {
  const getCopyFn     = useServerFn(getSiteCopy);
  const getHistoryFn  = useServerFn(getSiteCopyHistory);
  const setFn         = useServerFn(adminSetSiteCopy);
  const deleteFn      = useServerFn(adminDeleteSiteCopy);
  const qc            = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-site-copy"],
    queryFn: () => getCopyFn(),
  });

  // Build a fast lookup: key → DB row (only keys that have overrides)
  const overrideMap = useMemo(() => {
    const map: Record<string, SiteCopyRow> = {};
    for (const row of (rows ?? [])) map[row.key] = row;
    return map;
  }, [rows]);

  // Group all known keys by section
  const grouped = useMemo(() => {
    const sections: Record<string, string[]> = {};
    for (const key of Object.keys(SITE_COPY_DEFAULTS)) {
      const section = SITE_COPY_SECTIONS[key] ?? "Other";
      (sections[section] ??= []).push(key);
    }
    return sections;
  }, []);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [resetting, setResetting]   = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [restoring, setRestoring] = useState<number | null>(null);
  // Bumped after every successful save so the live preview drawer reloads.
  const [previewVersion, setPreviewVersion] = useState(0);

  function toggleHistory(key: string) {
    setExpandedHistory((current) => ({ ...current, [key]: !current[key] }));
  }

  function startEdit(key: string) {
    const current = overrideMap[key]?.value ?? SITE_COPY_DEFAULTS[key] ?? "";
    setDraft(current);
    setEditingKey(key);
  }

  async function handleSave(key: string) {
    setSaving(true);
    try {
      await setFn({ data: { key, value: draft } });
      await qc.invalidateQueries({ queryKey: ["admin-site-copy"] });
      toast.success("Copy saved");
      setEditingKey(null);
      setPreviewVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset(key: string) {
    setResetting(key);
    try {
      await deleteFn({ data: { key } });
      await qc.invalidateQueries({ queryKey: ["admin-site-copy"] });
      toast.success("Reset to default");
      setPreviewVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset");
    } finally {
      setResetting(null);
    }
  }

  async function handleRestore(key: string, history: SiteCopyHistoryRow) {
    setRestoring(history.id);
    try {
      await setFn({ data: { key, value: history.value } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-site-copy"] }),
        qc.invalidateQueries({ queryKey: ["admin-site-copy-history", key] }),
      ]);
      toast.success("Previous copy restored");
      setPreviewVersion((v) => v + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to restore copy");
    } finally {
      setRestoring(null);
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-card/40 p-5">
        <p className="text-sm text-muted-foreground">
          Override any landing page or home-dashboard text string. Leave a key at its
          default to use the hardcoded fallback. A{" "}
          <span className="inline-block size-2 rounded-full bg-primary align-middle" />{" "}
          dot in the live UI marks items that have active overrides.
        </p>
      </div>

      {Object.entries(grouped).map(([section, keys]) => (
        <section key={section} className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section}</h3>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3 w-[30%]">Label</th>
                  <th className="text-left p-3">Value</th>
                  <th className="text-right p-3 w-[120px]">Last edited</th>
                  <th className="text-right p-3 w-[140px]" />
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => {
                  const override   = overrideMap[key];
                  const isCustom   = !!override;
                  const isEditing  = editingKey === key;
                  const isBusy     = saving && isEditing;
                  const isResetting = resetting === key;
                  const displayed  = override?.value ?? SITE_COPY_DEFAULTS[key] ?? "";
                  const isHistoryOpen = !!expandedHistory[key];

                  return (
                    <HistoryGroup
                      key={key}
                      copyKey={key}
                      getHistoryFn={getHistoryFn}
                      isHistoryOpen={isHistoryOpen}
                      onRestore={handleRestore}
                      restoringId={restoring}
                    >
                    <tr className="border-t border-border hover:bg-card/20">
                      <td className="p-3 align-top">
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {isCustom && (
                            <span
                              title="Custom override active"
                              className="inline-block size-1.5 rounded-full bg-primary flex-shrink-0"
                            />
                          )}
                          {SITE_COPY_LABELS[key] ?? key}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{key}</div>
                      </td>
                      <td className="p-3 align-top">
                        {isEditing ? (
                          <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={3}
                            autoFocus
                            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        ) : (
                          <span className={`text-sm ${isCustom ? "text-foreground" : "text-muted-foreground italic"}`}>
                            {isCustom ? displayed : `(default) ${displayed.slice(0, 80)}${displayed.length > 80 ? "…" : ""}`}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right text-xs text-muted-foreground align-top whitespace-nowrap">
                        {override?.updated_at
                          ? new Date(override.updated_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="p-3 text-right align-top">
                        {isEditing ? (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => setEditingKey(null)}
                              disabled={isBusy}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 px-3 text-xs"
                              onClick={() => handleSave(key)}
                              disabled={isBusy}
                            >
                              {isBusy ? <Loader2 className="size-3 animate-spin" /> : "Save"}
                            </Button>
                          </div>
                        ) : (
                            <div className="flex gap-1 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => toggleHistory(key)}
                                title="Show previous values"
                              >
                                {isHistoryOpen ? <ChevronDown className="size-3 mr-1" /> : <ChevronRight className="size-3 mr-1" />}
                                History
                              </Button>
                            {isCustom && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => handleReset(key)}
                                disabled={isResetting}
                                title="Reset to hardcoded default"
                              >
                                {isResetting ? <Loader2 className="size-3 animate-spin" /> : "Reset"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 px-3 text-xs"
                              onClick={() => startEdit(key)}
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                    </HistoryGroup>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <LandingLivePreview version={previewVersion} />
    </div>
  );
}

function HistoryGroup({
  copyKey,
  getHistoryFn,
  isHistoryOpen,
  onRestore,
  restoringId,
  children,
}: {
  copyKey: string;
  getHistoryFn: ReturnType<typeof useServerFn<typeof getSiteCopyHistory>>;
  isHistoryOpen: boolean;
  onRestore: (key: string, history: SiteCopyHistoryRow) => Promise<void>;
  restoringId: number | null;
  children: React.ReactNode;
}) {
  const { data: history, isLoading, isError } = useQuery({
    queryKey: ["admin-site-copy-history", copyKey],
    queryFn: () => getHistoryFn({ data: { key: copyKey } }),
    enabled: isHistoryOpen,
  });

  return (
    <>
      {children}
      {isHistoryOpen && (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={4} className="p-3">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Previous values</p>
              {isLoading && <p className="text-xs text-muted-foreground">Loading history…</p>}
              {isError && <p className="text-xs text-destructive">Couldn&apos;t load this copy history.</p>}
              {!isLoading && !isError && (history ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">No previous values yet.</p>
              )}
              {(history ?? []).map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-background/50 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{entry.value}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(entry.changed_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 px-2 text-xs"
                    onClick={() => void onRestore(copyKey, entry)}
                    disabled={restoringId !== null}
                  >
                    {restoringId === entry.id ? <Loader2 className="mr-1 size-3 animate-spin" /> : <RotateCcw className="mr-1 size-3" />}
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function RouterPanel() {
  const healthFn = useServerFn(getRouterHealth);
  const logsFn = useServerFn(getRouterLogs);

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ["router-health"],
    queryFn: () => healthFn(),
    refetchInterval: 15_000,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ["router-logs"],
    queryFn: () => logsFn(),
    refetchInterval: 30_000,
  });

  const providers: RouterHealthRow[] = healthData?.providers ?? [];
  const degradedCategories = healthData?.degradedCategories ?? [];
  const logs: RouterLogRow[] = logsData?.logs ?? [];
  const migrationPending = logsData?.migrationPending ?? false;

  function pct(n: number | null) {
    if (n === null) return "—";
    return `${Math.round(n * 100)}%`;
  }
  function ms(n: number | null) {
    if (n === null) return "—";
    return `${Math.round(n)}ms`;
  }

  return (
    <div className="space-y-6">
      {degradedCategories.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-orange-300">
          <Activity className="mt-0.5 size-4 shrink-0 text-orange-400" />
          <div>
            <p className="text-sm font-medium">AI Router degraded</p>
            <p className="mt-0.5 text-xs text-orange-200/75">
              No healthy providers are available for: {degradedCategories.join(", ")}. Aurora will recover automatically as providers return.
            </p>
          </div>
        </div>
      )}
      {/* Provider health grid */}
      <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Provider health (5-min window)</h2>
          {healthLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {providers.map((p) => (
            <div
              key={p.name}
              className={`rounded-xl border p-3 space-y-1.5 ${
                !p.enabled
                  ? "border-border bg-muted/20 opacity-50"
                  : p.healthy
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-red-500/40 bg-red-500/10"
              }`}
            >
              <div className="flex items-center gap-2 justify-between">
                <span className="text-xs font-medium truncate">{p.displayName ?? p.name}</span>
                {!p.enabled ? (
                  <span className="text-[10px] text-muted-foreground shrink-0">OFF</span>
                ) : p.callsInWindow === 0 ? (
                  <Clock className="size-3 text-muted-foreground shrink-0" />
                ) : p.healthy ? (
                  <CheckCircle className="size-3 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="size-3 text-red-500 shrink-0" />
                )}
              </div>
              <div className="text-[10px] text-muted-foreground space-y-0.5">
                <div className="flex justify-between"><span>Calls</span><span>{p.callsInWindow}</span></div>
                <div className="flex justify-between"><span>Success</span><span>{pct(p.successRate)}</span></div>
                <div className="flex justify-between"><span>Avg lat.</span><span>{ms(p.avgLatencyMs)}</span></div>
              </div>
            </div>
          ))}
          {!healthLoading && providers.length === 0 && (
            <p className="col-span-full text-sm text-muted-foreground text-center py-4">
              No routing calls recorded yet — start a chat to see data.
            </p>
          )}
        </div>
      </section>

      {/* Recent log table */}
      <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-primary" />
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Recent routing decisions</h2>
          {logsLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>
        {migrationPending && (
          <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            ⚠ The <code>ai_router_logs</code> migration hasn't been applied to the live DB yet. Logs will appear here once applied.
          </p>
        )}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Provider</th>
                <th className="text-right p-3">Fallbacks</th>
                <th className="text-right p-3">Latency</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border hover:bg-card/40">
                  <td className="p-3 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleTimeString()}</td>
                  <td className="p-3 text-xs font-mono">{l.category}</td>
                  <td className="p-3 text-xs">{l.provider_used}</td>
                  <td className="p-3 text-right text-xs">{l.fallback_count}</td>
                  <td className="p-3 text-right text-xs">{l.latency_ms}ms</td>
                  <td className="p-3">
                    {l.success ? (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                        <CheckCircle className="size-3" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-500" title={l.failure_reason ?? ""}>
                        <XCircle className="size-3" /> Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!logsLoading && logs.length === 0 && !migrationPending && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">No routing decisions logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <Icon className="size-5 text-primary mb-3" />
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

const RESOURCE_FILES = [
  {
    name: "Premium Video Agent",
    desc: "Full source — premium video agent project",
    size: "402 KB",
    file: "/downloads/premium-video-agent.zip",
    tag: "Source",
  },
  {
    name: "TikTok + Shopify",
    desc: "TikTok × Shopify integration workspace",
    size: "192 KB",
    file: "/downloads/tiktok-shopify.zip",
    tag: "Integration",
  },
  {
    name: "ComfyUI Manager",
    desc: "ComfyUI Manager main branch — plugin manager for ComfyUI",
    size: "1.8 MB",
    file: "/downloads/comfyui-manager.zip",
    tag: "Tool",
  },
  {
    name: "Temu AI Course Creator",
    desc: "AI-powered course creator project source",
    size: "1.1 MB",
    file: "/downloads/temu-ai-course-creator.zip",
    tag: "Source",
  },
  {
    name: "Cutlab Studio — Reusable Templates",
    desc: "Cutlab reusable UI templates (latest snapshot)",
    size: "743 KB",
    file: "/downloads/cutlab-studio-templates.zip",
    tag: "Templates",
  },
  {
    name: "Cutlab Studio — Source",
    desc: "Cutlab Studio full source code",
    size: "729 KB",
    file: "/downloads/cutlab-studio-source.zip",
    tag: "Source",
  },
] as const;

function ResourcesPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Resource Downloads</h2>
        <p className="text-sm text-muted-foreground mt-1">Uploaded project files and integrations available for download.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {RESOURCE_FILES.map((r) => (
          <a
            key={r.file}
            href={r.file}
            download
            className="group flex items-start justify-between gap-4 rounded-2xl border border-border bg-card/40 p-5 hover:border-primary/50 hover:bg-card transition-colors no-underline"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  {r.tag}
                </span>
              </div>
              <p className="font-semibold text-foreground truncate">{r.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-2">{r.size}</p>
            </div>
            <span className="shrink-0 mt-1 flex size-9 items-center justify-center rounded-xl border border-border bg-background/60 group-hover:border-primary/50 group-hover:text-primary transition-colors text-muted-foreground">
              ↓
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
