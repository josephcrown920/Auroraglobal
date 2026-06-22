import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { orchestrationHealth } from "@/lib/orchestration.functions";
import { AdminGate, hasAdminToken } from "@/components/AdminGate";
import { Activity, ArrowLeft, CheckCircle2, XCircle, Server, Zap, Image as ImageIcon, Film, Mic, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/orchestration")({
  component: OrchestrationDashboard,
  head: () => ({
    meta: [
      { title: "Orchestration — Aurora Admin" },
      { name: "description", content: "Live view of AI provider fallback chains and worker health." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Kind = "image" | "video" | "lipsync" | "inference";

const KIND_META: Record<Kind, { label: string; icon: typeof ImageIcon; accent: string }> = {
  image:     { label: "Image",   icon: ImageIcon, accent: "text-fuchsia-400" },
  video:     { label: "Video",   icon: Film,      accent: "text-pink-400" },
  lipsync:   { label: "Lipsync", icon: Mic,       accent: "text-cyan-400" },
  inference: { label: "Text",    icon: Zap,       accent: "text-amber-400" },
};

function OrchestrationDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState<boolean>(() => hasAdminToken());

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const healthFn = useServerFn(orchestrationHealth);
  const { data, isLoading, error } = useQuery({
    queryKey: ["orchestration-health"],
    queryFn: () => healthFn(),
    enabled: !!user && unlocked,
    refetchInterval: 15_000,
  });

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }
  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;

  const kinds: Kind[] = ["image", "video", "lipsync", "inference"];
  const byKind = (k: Kind) => data?.providers.filter((p) => p.kind === k) ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/admin" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
              <ArrowLeft className="size-3.5" /> Back to admin
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Activity className="size-5 text-primary" /> Orchestration
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Live provider chains, worker pool, last 24h activity.</p>
          </div>
          {data && (
            <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full border border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {data.summary.configured}/{data.summary.total} providers · {data.summary.activeWorkers} workers
            </div>
          )}
        </div>

        {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading health…</div>}
        {error && <div className="text-sm text-destructive">{error instanceof Error ? error.message : "Failed"}</div>}

        {data && (
          <>
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
                      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">fallback chain</span>
                    </div>
                    <div className="space-y-2">
                      {providers.map((p, i) => {
                        const s = data.stats[p.id.split("-")[0]] ?? data.stats[p.id];
                        return (
                          <div key={p.id} className="flex items-center gap-3 text-xs">
                            <span className="font-mono text-muted-foreground w-7">P{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{p.name}</span>
                                {p.free && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">FREE</span>}
                                {p.configured
                                  ? <CheckCircle2 className="size-3 text-emerald-400" />
                                  : <XCircle className="size-3 text-destructive" />}
                                {p.configured && !p.ready && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20" title={`${p.failures} recent failure(s) · cooling down ${Math.ceil(p.cooldownMs/1000)}s`}>COOLDOWN</span>
                                )}
                                {p.configured && p.ready && p.failures === 0 && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">READY</span>
                                )}
                              </div>
                              {p.notes && <div className="text-[10px] text-muted-foreground font-mono truncate">{p.notes}</div>}

                            </div>
                            {s && (
                              <div className="text-[10px] font-mono text-muted-foreground tabular-nums text-right">
                                <div className="text-emerald-400">{s.ok}✓</div>
                                {s.err > 0 && <div className="text-destructive">{s.err}✕</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-3 text-xs pt-2 border-t border-border/50 mt-2">
                        <span className="font-mono text-muted-foreground w-7">P∞</span>
                        <div className="flex-1 flex items-center gap-2">
                          <Server className="size-3 text-muted-foreground" />
                          <span className="font-medium">GPU Worker Pool</span>
                          <span className="text-[10px] text-muted-foreground">({data.summary.activeWorkers} active)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent calls */}
            <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold">Recent calls (24h)</span>
                <span className="text-[10px] font-mono text-muted-foreground">{data.recent.length} of last 200</span>
              </div>
              <div className="divide-y divide-border/50 max-h-[420px] overflow-auto">
                {data.recent.length === 0 && (
                  <div className="px-5 py-8 text-sm text-muted-foreground text-center">No activity in the last 24 hours.</div>
                )}
                {data.recent.map((l, i) => (
                  <div key={i} className="px-5 py-2.5 flex items-center gap-3 text-xs font-mono">
                    {l.status === "ok"
                      ? <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                      : <XCircle className="size-3 text-destructive shrink-0" />}
                    <span className="text-muted-foreground w-16 shrink-0">{l.kind}</span>
                    <span className="text-foreground w-28 shrink-0 truncate">{l.provider}</span>
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
