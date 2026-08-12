import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  listPipelineJobs,
  type PipelineJob,
  type PipelineBatch,
} from "@/lib/pipeline-jobs.functions";
import {
  Loader2,
  RefreshCw,
  Lock as LockIcon,
  Camera,
  Megaphone,
  Workflow,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
} from "lucide-react";

export const Route = createLazyFileRoute("/jobs")({ component: JobsPage });

const STAGE_META: Record<
  PipelineJob["stage"],
  { label: string; icon: typeof LockIcon; tint: string }
> = {
  likeness_lock: { label: "Likeness Lock", icon: LockIcon, tint: "text-amber-400" },
  deck_render: { label: "Deck Render", icon: Camera, tint: "text-sky-400" },
  ad_variation: { label: "Ad Variation", icon: Megaphone, tint: "text-fuchsia-400" },
  queued_job: { label: "Background Job", icon: Workflow, tint: "text-emerald-400" },
};

function StatusPill({ status }: { status: PipelineJob["status"] }) {
  const map: Record<PipelineJob["status"], { label: string; className: string; Icon: typeof Clock }> = {
    queued: { label: "Queued", className: "bg-muted text-muted-foreground", Icon: Clock },
    processing: { label: "Processing", className: "bg-sky-500/15 text-sky-400", Icon: Loader2 },
    succeeded: { label: "Succeeded", className: "bg-emerald-500/15 text-emerald-400", Icon: CheckCircle2 },
    failed: { label: "Failed", className: "bg-destructive/20 text-destructive", Icon: AlertCircle },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground", Icon: AlertCircle },
  };
  const { label, className, Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}
    >
      <Icon className={`size-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

function formatEta(sec: number | null): string {
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s left`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m < 60 ? `${m}m ${s}s left` : `${Math.floor(m / 60)}h ${m % 60}m left`;
}

function BatchTimeline({ batches }: { batches: PipelineBatch[] }) {
  if (batches.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Workflow className="size-4 text-fuchsia-400" />
        Batch progress <span className="text-muted-foreground">({batches.length})</span>
      </h2>
      <div className="space-y-3">
        {batches.slice(0, 8).map((b) => {
          const color =
            b.status === "succeeded"
              ? "bg-emerald-500"
              : b.status === "failed"
                ? "bg-destructive"
                : "bg-sky-500";
          return (
            <div
              key={b.batchId}
              className="rounded-xl border border-border/50 bg-card/40 p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    Batch <span className="text-muted-foreground font-mono text-[11px]">{b.batchId.slice(0, 8)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {b.currentStep} · started {new Date(b.startedAt).toLocaleTimeString()}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold tabular-nums">{b.percent}%</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {b.status === "processing" ? formatEta(b.estimatedRemainingSec) : b.status}
                  </div>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={`h-full ${color} transition-all`}
                  style={{ width: `${Math.max(2, b.percent)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {b.succeeded} succeeded · {b.failed} failed · {b.processing} in flight
                </span>
                {b.firstAssetUrl && (
                  <a
                    href={b.firstAssetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Open result <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function JobsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const listFn = useServerFn(listPipelineJobs);
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["pipeline-jobs"],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: 8000,
  });

  const jobs = data?.jobs ?? [];
  const batches = data?.batches ?? [];

  // ── In-app notifications: toast when a batch transitions to terminal ──
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (typeof window === "undefined") return;
    // hydrate from localStorage so a page reload doesn't re-notify
    if (notifiedRef.current.size === 0) {
      try {
        const seen = JSON.parse(
          window.localStorage.getItem("aurora:jobs:notified") ?? "[]",
        ) as string[];
        seen.forEach((k) => notifiedRef.current.add(k));
      } catch { /* localStorage unavailable — non-fatal */ }
    }
    for (const b of batches) {
      if (b.status === "processing") continue;
      const key = `${b.batchId}:${b.status}`;
      if (notifiedRef.current.has(key)) continue;
      notifiedRef.current.add(key);
      if (b.status === "succeeded") {
        toast.success(`Batch finished · ${b.succeeded}/${b.total} assets ready`, {
          description: `Batch ${b.batchId.slice(0, 8)}`,
          action: b.firstAssetUrl
            ? { label: "Open", onClick: () => window.open(b.firstAssetUrl!, "_blank") }
            : undefined,
        });
      } else {
        toast.error(`Batch failed · ${b.failed}/${b.total} errors`, {
          description: `Batch ${b.batchId.slice(0, 8)} — see error logs below`,
        });
      }
    }
    try {
      window.localStorage.setItem(
        "aurora:jobs:notified",
        JSON.stringify(Array.from(notifiedRef.current).slice(-200)),
      );
    } catch { /* localStorage unavailable — non-fatal */ }
  }, [batches]);
  const counts = {
    total: jobs.length,
    running: jobs.filter((j) => j.status === "processing" || j.status === "queued").length,
    succeeded: jobs.filter((j) => j.status === "succeeded").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  };

  const grouped: Record<PipelineJob["stage"], PipelineJob[]> = {
    likeness_lock: [],
    deck_render: [],
    ad_variation: [],
    queued_job: [],
  };
  for (const j of jobs) grouped[j.stage].push(j);

  return (
    <div className="min-h-dvh px-4 py-8 max-w-5xl mx-auto pb-32">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Job Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live status of every likeness lock, deck render, and ad export — with per-job error logs.
        </p>
      </header>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: counts.total },
          { label: "In flight", value: counts.running },
          { label: "Succeeded", value: counts.succeeded },
          { label: "Failed", value: counts.failed },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border/50 bg-card/40 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {s.label}
            </div>
            <div className="text-2xl font-bold mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-muted-foreground">
          Auto-refresh every 8s
          {isFetching && <span className="ml-2">· syncing…</span>}
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 text-xs bg-card/40 border border-border/60 rounded-md px-2.5 py-1.5 hover:bg-card/60"
        >
          <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <BatchTimeline batches={batches} />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
          <Loader2 className="size-4 animate-spin" /> Loading pipeline…
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          No pipeline activity yet — lock a likeness on <span className="text-primary">/likeness</span>{" "}
          or run a workflow on <span className="text-primary">/orchestration-engine</span> to start.
        </div>
      ) : (
        <div className="space-y-8">
          {(Object.keys(grouped) as PipelineJob["stage"][])
            .filter((s) => grouped[s].length > 0)
            .map((stage) => {
              const meta = STAGE_META[stage];
              const Icon = meta.icon;
              const rows = grouped[stage];
              return (
                <section key={stage}>
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Icon className={`size-4 ${meta.tint}`} />
                    {meta.label} <span className="text-muted-foreground">({rows.length})</span>
                  </h2>
                  <div className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/40">
                    {rows.map((j) => (
                      <div key={j.id} className="p-3 flex items-start gap-3 bg-card/30">
                        {j.url ? (
                          <a
                            href={j.url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 w-14 h-14 rounded-md overflow-hidden bg-muted"
                          >
                            <img
                              src={j.url}
                              alt=""
                              loading="lazy"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = "none";
                              }}
                            />
                          </a>
                        ) : (
                          <div className="shrink-0 w-14 h-14 rounded-md bg-muted/40 flex items-center justify-center">
                            <Icon className={`size-5 ${meta.tint}`} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-medium truncate">{j.label}</div>
                            <StatusPill status={j.status} />
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(j.createdAt).toLocaleString()}
                          </div>
                          {j.error && (
                            <pre className="mt-2 text-[11px] text-destructive whitespace-pre-wrap break-all bg-destructive/5 border border-destructive/20 rounded p-2 max-h-28 overflow-auto">
                              {j.error}
                            </pre>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
