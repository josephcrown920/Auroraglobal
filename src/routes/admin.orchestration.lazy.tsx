import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { orchestrationHealth, providerCredits } from "@/lib/orchestration.functions";
import type { ProviderCreditRow } from "@/lib/orchestration.functions";
import { AdminGate, useAdminAutoUnlock } from "@/components/AdminGate";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Server,
  Zap,
  Image as ImageIcon,
  Film,
  Mic,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  DollarSign,
} from "lucide-react";

export const Route = createLazyFileRoute("/admin/orchestration")({
  component: OrchestrationDashboard,
});

type Kind = "image" | "video" | "lipsync" | "text" | "audio";

const KIND_META: Record<Kind, { label: string; icon: typeof ImageIcon; accent: string }> = {
  image: { label: "Image", icon: ImageIcon, accent: "text-brand" },
  video: { label: "Video", icon: Film, accent: "text-pink-400" },
  lipsync: { label: "Lipsync", icon: Mic, accent: "text-cyan-400" },
  text: { label: "Text", icon: Zap, accent: "text-amber-400" },
  audio: { label: "Speech", icon: Mic, accent: "text-emerald-400" },
};

type BillingBucket = "replit" | "gpu" | "paid";
function classifyBilling(provider: string): BillingBucket {
  if (provider.startsWith("replit-") || provider.startsWith("replit/")) return "replit";
  if (provider === "runpod") return "gpu";
  return "paid";
}

const BILLING_META: Record<
  BillingBucket,
  { label: string; badgeClass: string; textClass: string }
> = {
  replit: {
    label: "Replit credits",
    badgeClass: "bg-brand/10 text-brand border-brand/20",
    textClass: "text-brand",
  },
  gpu: {
    label: "GPU worker",
    badgeClass: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    textClass: "text-sky-400",
  },
  paid: {
    label: "Paid provider",
    badgeClass: "bg-muted/40 text-muted-foreground border-border",
    textClass: "text-muted-foreground",
  },
};

function BillingBadge({ provider }: { provider: string }) {
  const bucket = classifyBilling(provider);
  const meta = BILLING_META[bucket];
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border shrink-0 ${meta.badgeClass}`}>
      {meta.label}
    </span>
  );
}

const STATUS_META: Record<
  ProviderCreditRow["status"],
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  ok:           { label: "OK",          dot: "bg-emerald-400",              text: "text-emerald-400",    bg: "bg-emerald-500/5",  border: "border-emerald-500/20" },
  low:          { label: "LOW",         dot: "bg-amber-400 animate-pulse",  text: "text-amber-400",      bg: "bg-amber-500/5",    border: "border-amber-500/30"  },
  empty:        { label: "EMPTY",       dot: "bg-red-500 animate-pulse",    text: "text-red-400",        bg: "bg-red-500/5",      border: "border-red-500/30"    },
  error:        { label: "ERROR",       dot: "bg-red-400",                  text: "text-red-400",        bg: "bg-red-500/5",      border: "border-red-500/20"    },
  unconfigured: { label: "NO KEY",      dot: "bg-muted-foreground/30",      text: "text-muted-foreground", bg: "bg-muted/20",     border: "border-border"        },
  "no-api":     { label: "CONFIGURED",  dot: "bg-emerald-400",              text: "text-emerald-400",    bg: "bg-card/40",        border: "border-border"        },
};

function formatBalance(p: ProviderCreditRow): string {
  if (p.balance === null) {
    if (p.status === "ok" && p.hasBalanceApi) return "Unlimited";
    if (p.status === "no-api") return "Key valid · check dashboard";
    if (p.status === "unconfigured") return "No API key set";
    return "—";
  }
  if (p.unit === "$USD") return `$${p.balance.toFixed(2)} remaining${p.limitTotal ? ` of $${p.limitTotal.toFixed(2)}` : ""}`;
  if (p.unit === "chars") {
    const fmt = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : `${n}`;
    return `${fmt(p.balance)} remaining${p.limitTotal ? ` of ${fmt(p.limitTotal)}` : ""}`;
  }
  return `${p.balance} ${p.unit ?? "credits"}`;
}

function CreditCard({ p }: { p: ProviderCreditRow }) {
  const sm = STATUS_META[p.status];
  const pct =
    p.balance !== null && p.limitTotal !== null && p.limitTotal > 0
      ? Math.max(0, Math.min(100, (p.balance / p.limitTotal) * 100))
      : null;

  return (
    <div className={`rounded-lg border p-3.5 flex flex-col gap-2 ${sm.bg} ${sm.border}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold truncate">{p.name}</span>
        <a
          href={p.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Open provider dashboard"
        >
          <ExternalLink className="size-3.5" />
        </a>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`size-2 rounded-full shrink-0 ${sm.dot}`} />
        <span className={`text-xs font-medium ${sm.text}`}>{sm.label}</span>
        {p.hasBalanceApi && p.status !== "unconfigured" && (
          <span className="text-xs px-1 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 ml-auto shrink-0">
            live
          </span>
        )}
      </div>
      <div className="text-[13px] text-muted-foreground leading-snug">
        {p.error ? (
          <span className="text-red-400 truncate block" title={p.error}>
            {p.error.slice(0, 60)}
          </span>
        ) : (
          formatBalance(p)
        )}
      </div>
      {pct !== null && (
        <div className="w-full h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              pct > 30 ? "bg-emerald-400" : pct > 10 ? "bg-amber-400" : "bg-red-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function formatAge(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

function OrchestrationDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useAdminAutoUnlock(!!user);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const healthFn = useServerFn(orchestrationHealth);
  const { data, isLoading, error } = useQuery({
    queryKey: ["orchestration-health"],
    queryFn: () => healthFn(),
    enabled: !!user && unlocked,
    refetchInterval: 15_000,
  });

  const creditsFn = useServerFn(providerCredits);
  const {
    data: credits,
    isLoading: creditsLoading,
    refetch: refetchCredits,
    dataUpdatedAt: creditsUpdatedAt,
  } = useQuery({
    queryKey: ["provider-credits"],
    queryFn: () => creditsFn(),
    enabled: !!user && unlocked,
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;

  const kinds: Kind[] = ["image", "video", "lipsync", "text", "audio"];
  const byKind = (k: Kind) => data?.providers.filter((p) => p.kind === k) ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3"
            >
              <ArrowLeft className="size-3.5" /> Back to admin
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Activity className="size-5 text-primary" /> Orchestration
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live provider chains, worker pool, last 24h activity.
            </p>
          </div>
          {data && (
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {data.summary.configured}/{data.summary.total} providers ·{" "}
              {data.summary.activeWorkers} workers
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading health…
          </div>
        )}
        {error && (
          <div className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed"}
          </div>
        )}

        {data && (
          <>
            {/* Billing summary */}
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {(["replit", "gpu", "paid"] as const).map((bucket) => {
                const meta = BILLING_META[bucket];
                const b = data.billingSummary?.[bucket] ?? { ok: 0, err: 0, cost: 0 };
                const total = b.ok + b.err;
                return (
                  <div key={bucket} className="rounded-xl border border-border bg-card/40 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold ${meta.textClass}`}>{meta.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${meta.badgeClass}`}>24h</span>
                    </div>
                    <div className="text-2xl font-semibold tabular-nums">{total}</div>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
                      <span className="text-emerald-400">{b.ok} ok</span>
                      {b.err > 0 && <span className="text-destructive">{b.err} failed</span>}
                      <span className="ml-auto tabular-nums">${b.cost.toFixed(3)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Generation queue — customer-impacting pipeline signals */}
            <div className="rounded-xl border border-border bg-card/40 mb-8 p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="size-4 text-primary" /> Generation queue
                </span>
                <span className="text-xs text-muted-foreground">jobs created in last 24h · stall checks are live</span>
              </div>
              <div className="grid sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{data.queue.totals24h.queued}</div>
                  <div className="text-sm text-muted-foreground">queued</div>
                  <div
                    className={`text-xs mt-1 ${
                      (data.queue.oldestQueuedAgeSec ?? 0) > 20 * 60 ? "text-amber-400" : "text-muted-foreground"
                    }`}
                  >
                    {data.queue.oldestQueuedAgeSec == null
                      ? "no waiting jobs"
                      : `oldest waiting ${formatAge(data.queue.oldestQueuedAgeSec)}`}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{data.queue.totals24h.processing}</div>
                  <div className="text-sm text-muted-foreground">processing</div>
                  <div className={`text-xs mt-1 ${data.queue.staleProcessing > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {data.queue.staleProcessing > 0
                      ? `${data.queue.staleProcessing} stale lock${data.queue.staleProcessing > 1 ? "s" : ""} (>30m — sweeps stalled?)`
                      : "locks healthy"}
                  </div>
                </div>
                <div>
                  <div className={`text-2xl font-semibold tabular-nums ${data.queue.totals24h.failed > 0 ? "text-destructive" : ""}`}>
                    {data.queue.totals24h.failed}
                  </div>
                  <div className="text-sm text-muted-foreground">failed · 24h</div>
                  <div className="text-xs mt-1 text-emerald-400">{data.queue.totals24h.succeeded} succeeded</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{data.queue.videoAgent7d.active}</div>
                  <div className="text-sm text-muted-foreground">Video Agent rendering</div>
                  <div className="text-xs mt-1 text-muted-foreground">
                    7d: <span className="text-emerald-400">{data.queue.videoAgent7d.succeeded} ok</span>
                    {data.queue.videoAgent7d.failed > 0 && (
                      <span className="text-destructive"> · {data.queue.videoAgent7d.failed} failed</span>
                    )}
                  </div>
                </div>
              </div>
              {data.queue.byKind.some((k) => k.failed > 0) && (
                <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2">
                  {data.queue.byKind
                    .filter((k) => k.failed > 0)
                    .slice(0, 6)
                    .map((k) => (
                      <span
                        key={k.kind}
                        className="text-xs px-2 py-0.5 rounded-full border border-destructive/30 text-destructive bg-destructive/5"
                      >
                        {k.kind}: {k.failed} failed
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Provider Credit Balances */}
            <div className="rounded-xl border border-border bg-card/40 mb-8">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="size-4 text-primary" /> Provider Credits
                </span>
                <div className="flex items-center gap-3 ml-auto">
                  {credits && creditsUpdatedAt > 0 && (
                    <span className="text-[13px] text-muted-foreground">
                      {timeAgo(new Date(creditsUpdatedAt).toISOString())}
                    </span>
                  )}
                  {credits && credits.alertCount > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      <AlertTriangle className="size-3" />
                      {credits.alertCount} alert{credits.alertCount > 1 ? "s" : ""}
                    </span>
                  )}
                  <button
                    onClick={() => refetchCredits()}
                    disabled={creditsLoading}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`size-3.5 ${creditsLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>
              </div>

              {creditsLoading && !credits && (
                <div className="px-5 py-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Fetching balances…
                </div>
              )}

              {credits && (
                <>
                  {credits.alertCount > 0 && (
                    <div className="mx-5 mt-4 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300 flex items-center gap-2">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>
                        {credits.providers
                          .filter((p) => p.status === "low" || p.status === "empty" || p.status === "error")
                          .map((p) => `${p.name}: ${p.status.toUpperCase()}`)
                          .join(" · ")}
                      </span>
                    </div>
                  )}
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {credits.providers.map((p) => (
                      <CreditCard key={p.id} p={p} />
                    ))}
                  </div>
                  <div className="px-5 py-2.5 border-t border-border text-[13px] text-muted-foreground">
                    Live balances refresh every 5 min. Providers without a public balance API show key status only.
                  </div>
                </>
              )}
            </div>

            {/* Fallback chains per kind */}
            <div className="grid md:grid-cols-2 gap-4 mb-8">
              {kinds.map((k) => {
                const Meta = KIND_META[k];
                const Icon = Meta.icon;
                const providers = byKind(k);
                return (
                  <div key={k} className="rounded-xl border border-border bg-card/40 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Icon className={`size-4 ${Meta.accent}`} />
                        <span className="text-sm font-semibold">{Meta.label}</span>
                      </div>
                      <span className="text-[13px] uppercase tracking-wider text-muted-foreground">fallback chain</span>
                    </div>
                    <div className="space-y-2">
                      {providers.map((p, i) => {
                        const s = data.stats[p.id.split("-")[0]] ?? data.stats[p.id];
                        return (
                          <div key={p.id} className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground w-7">P{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{p.name}</span>
                                <BillingBadge provider={p.id} />
                                {p.free && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">FREE</span>
                                )}
                                {p.configured ? (
                                  <CheckCircle2 className="size-3 text-emerald-400" />
                                ) : (
                                  <XCircle className="size-3 text-destructive" />
                                )}
                                {p.configured && !p.ready && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">COOLDOWN</span>
                                )}
                                {p.configured && p.ready && p.failures === 0 && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">READY</span>
                                )}
                              </div>
                              {p.notes && <div className="text-[13px] text-muted-foreground truncate">{p.notes}</div>}
                            </div>
                            {s && (
                              <div className="text-[13px] text-muted-foreground tabular-nums text-right">
                                <div className="text-emerald-400">{s.ok}✓</div>
                                {s.err > 0 && <div className="text-destructive">{s.err}✕</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-3 text-xs pt-2 border-t border-border/50 mt-2">
                        <span className="text-muted-foreground w-7">P∞</span>
                        <div className="flex-1 flex items-center gap-2">
                          <Server className="size-3 text-muted-foreground" />
                          <span className="font-medium">GPU Worker Pool</span>
                          <span className="text-[13px] text-muted-foreground">({data.summary.activeWorkers} active)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* GPU backends */}
            <div className="rounded-xl border border-border bg-card/40 mb-8">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Server className="size-4 text-muted-foreground" /> Pluggable GPU backends
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {data.gpuBackends.filter((b) => b.configured).length}/{data.gpuBackends.length} configured
                </span>
              </div>
              <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.gpuBackends.map((b) => (
                  <div key={b.id} className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      {b.configured ? (
                        <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="size-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-medium flex-1 truncate">{b.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border">{b.id}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {b.protocolTasks.map((t) => {
                        const supported = b.tasks.includes(t);
                        return (
                          <span
                            key={t}
                            className={
                              "text-xs px-1.5 py-0.5 rounded border " +
                              (supported
                                ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                                : "bg-muted/20 text-muted-foreground/50 border-border/40 line-through")
                            }
                          >
                            {t}
                          </span>
                        );
                      })}
                    </div>
                    {b.configured ? (
                      <div className="text-[13px] text-emerald-400">configured</div>
                    ) : (
                      <div className="text-[13px] text-amber-400 truncate">missing: {b.missing.join(", ") || "—"}</div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span
                        className={
                          "size-1.5 rounded-full shrink-0 " +
                          (b.health === "online" ? "bg-emerald-400" : b.health === "offline" ? "bg-red-400" : b.health === "unknown" ? "bg-amber-400" : "bg-muted-foreground/40")
                        }
                      />
                      <span
                        className={
                          "text-[13px] truncate " +
                          (b.health === "online" ? "text-emerald-400" : b.health === "offline" ? "text-red-400" : b.health === "unknown" ? "text-amber-400" : "text-muted-foreground")
                        }
                      >
                        health: {b.health ?? "not configured"}{b.healthDetail ? ` · ${b.healthDetail}` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-2.5 border-t border-border text-[13px] text-muted-foreground">
                Standalone HTTP-out inference layer (Colab · RunPod · HF Spaces · Vast.ai · ComfyUI).
              </div>
            </div>

            {/* Recent calls */}
            <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold">Recent calls (24h)</span>
                <span className="text-[13px] text-muted-foreground">{data.recent.length} of last 200</span>
              </div>
              <div className="divide-y divide-border/50 max-h-[420px] overflow-auto">
                {data.recent.length === 0 && (
                  <div className="px-5 py-8 text-sm text-muted-foreground text-center">No activity in the last 24 hours.</div>
                )}
                {data.recent.map((l, i) => (
                  <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                    {l.status === "ok" ? (
                      <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="size-3 text-destructive shrink-0" />
                    )}
                    <span className="text-muted-foreground w-16 shrink-0">{l.kind}</span>
                    <span className={`w-28 shrink-0 truncate ${BILLING_META[classifyBilling(l.provider)].textClass}`}>{l.provider}</span>
                    <BillingBadge provider={l.provider} />
                    <span className="text-muted-foreground flex-1 truncate">{l.endpoint}</span>
                    <span className="text-muted-foreground tabular-nums w-16 text-right">{l.latency_ms}ms</span>
                    <span className="text-muted-foreground tabular-nums w-16 text-right">${Number(l.cost_usd ?? 0).toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
