import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  adminModelWatchList,
  adminModelWatchScanNow,
  adminModelWatchSetStatus,
} from "@/lib/admin.functions";
import type { ModelWatchRow } from "@/lib/model-watch.server";
import { AdminGate, useAdminAutoUnlock } from "@/components/AdminGate";
import { ArrowLeft, Check, EyeOff, Loader2, Radar, RefreshCw } from "lucide-react";

export const Route = createLazyFileRoute("/admin/models")({
  component: ModelWatchPage,
});

const AVAILABILITY_BADGE: Record<string, { label: string; cls: string }> = {
  open: { label: "Callable now", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
  not_open: { label: "Not activated", cls: "text-amber-400 bg-amber-500/10 border-amber-500/25" },
  not_found: { label: "Slug not found", cls: "text-rose-400 bg-rose-500/10 border-rose-500/25" },
  error: { label: "Probe error", cls: "text-muted-foreground bg-muted border-border" },
};

const PROVIDER_CLS: Record<string, string> = {
  fal: "text-pink-400 bg-pink-500/10",
  replicate: "text-cyan-400 bg-cyan-500/10",
  modelark: "text-violet-400 bg-violet-500/10",
};

function ModelWatchPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useAdminAutoUnlock(!!user);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const listFn = useServerFn(adminModelWatchList);
  const scanFn = useServerFn(adminModelWatchScanNow);
  const setStatusFn = useServerFn(adminModelWatchSetStatus);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-model-watch"],
    queryFn: () => listFn(),
    enabled: !!user && unlocked,
    staleTime: 30_000,
  });

  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleScanNow() {
    setScanning(true);
    setScanNote(null);
    try {
      const r = await scanFn();
      const errs = Object.entries(r.provider_errors ?? {});
      setScanNote(
        `Scan done — ${r.new_models.length} new, ${r.seeded} baselined, ${r.transitions.length} availability change(s)` +
          (errs.length ? ` · notes: ${errs.map(([p, m]) => `${p}: ${m}`).join(" | ")}` : ""),
      );
      await refetch();
    } catch (err) {
      setScanNote(`Scan failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScanning(false);
    }
  }

  async function mark(row: ModelWatchRow, status: "reviewed" | "ignored") {
    setBusyId(row.id);
    try {
      await setStatusFn({ data: { id: row.id, status } });
      await refetch();
    } finally {
      setBusyId(null);
    }
  }

  const rows: ModelWatchRow[] = data?.rows ?? [];
  const anticipated = rows.filter((r) => r.watch_kind === "anticipated");
  const newArrivals = rows.filter((r) => r.watch_kind === "catalog" && r.status === "new");
  const seededCount = rows.filter((r) => r.watch_kind === "catalog" && r.status === "seeded").length;
  const reviewedCount = rows.filter((r) => r.status === "reviewed").length;
  const ignoredCount = rows.filter((r) => r.status === "ignored").length;

  if (loading || !user) return null;
  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;

  return (
    <div className="min-h-dvh bg-background px-4 pb-24 pt-6">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                to="/admin"
                className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
                aria-label="Back to admin"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <div>
                <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <Radar className="size-5 text-brand" /> Model Watch
                </h1>
                <p className="text-xs text-muted-foreground">
                  Auto-scans fal.ai + Replicate every 6 h and probes awaited ModelArk slugs.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={handleScanNow}
                disabled={scanning}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {scanning ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
                {scanning ? "Scanning…" : "Scan now"}
              </button>
            </div>
          </div>

          {scanNote && (
            <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">{scanNote}</p>
          )}

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error instanceof Error ? error.message : String(error)}
            </p>
          ) : null}

          {/* Anticipated ModelArk slugs */}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <h2 className="text-sm font-semibold text-foreground">Waiting on activation</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ModelArk slugs Aurora is already wired for. “Not activated” means: open the BytePlus Ark
              Console and activate the model — you’ll get an email the moment a probe flips to callable.
            </p>
            <div className="mt-3 space-y-2">
              {anticipated.length === 0 && (
                <p className="text-xs text-muted-foreground">No probes recorded yet — run a scan.</p>
              )}
              {anticipated.map((r) => {
                const badge = AVAILABILITY_BADGE[r.availability ?? "error"] ?? AVAILABILITY_BADGE.error;
                const auroraKey =
                  typeof r.meta?.aurora_key === "string" ? (r.meta.aurora_key as string) : null;
                return (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{r.title ?? r.model_id}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {r.model_id}
                        {auroraKey ? ` · Aurora: ${auroraKey}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* New catalog arrivals */}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <h2 className="text-sm font-semibold text-foreground">New arrivals</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Models spotted in provider catalogs since the baseline. Review, then wire the ones worth adding.
            </p>
            <div className="mt-3 space-y-2">
              {isLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              {!isLoading && newArrivals.length === 0 && (
                <p className="text-xs text-muted-foreground">Nothing new since the last baseline.</p>
              )}
              {newArrivals.map((r) => (
                <div key={r.id} className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PROVIDER_CLS[r.provider] ?? "text-muted-foreground bg-muted"}`}>
                          {r.provider}
                        </span>
                        <p className="truncate text-sm font-medium text-foreground">{r.title ?? r.model_id}</p>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{r.model_id}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.category ? `${r.category} · ` : ""}
                        first seen {new Date(r.first_seen).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={() => mark(r, "reviewed")}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 disabled:opacity-50"
                      >
                        <Check className="size-3" /> Reviewed
                      </button>
                      <button
                        onClick={() => mark(r, "ignored")}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground disabled:opacity-50"
                      >
                        <EyeOff className="size-3" /> Ignore
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              {seededCount} baselined silently · {reviewedCount} reviewed · {ignoredCount} ignored
            </p>
          </section>
      </div>
    </div>
  );
}
