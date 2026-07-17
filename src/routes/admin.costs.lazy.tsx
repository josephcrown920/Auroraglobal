import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { adminCostStats } from "@/lib/admin.functions";
import { AdminGate, useAdminAutoUnlock } from "@/components/AdminGate";
import { BarChart2, ArrowLeft, Coins, Loader2, TrendingUp, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createLazyFileRoute("/admin/costs")({
  component: CostDashboard,
});

const KIND_COLORS: Record<string, string> = {
  image: "text-brand bg-brand/10",
  video: "text-pink-400 bg-pink-500/10",
  lipsync: "text-cyan-400 bg-cyan-500/10",
  motion: "text-purple-400 bg-purple-500/10",
  text: "text-amber-400 bg-amber-500/10",
  audio: "text-emerald-400 bg-emerald-500/10",
  upscale: "text-blue-400 bg-blue-500/10",
  autocut: "text-orange-400 bg-orange-500/10",
  kids_story: "text-yellow-400 bg-yellow-500/10",
};

function kindStyle(kind: string) {
  return KIND_COLORS[kind] ?? "text-muted-foreground bg-muted";
}

function CostDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useAdminAutoUnlock(!!user);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const statsFn = useServerFn(adminCostStats);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-cost-stats"],
    queryFn: () => statsFn(),
    enabled: !!user && unlocked,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [viewDays, setViewDays] = useState<7 | 30>(30);

  const filteredDays = data?.byDayKind.filter((r) => {
    const cutoff = new Date(Date.now() - viewDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return r.day >= cutoff;
  });

  const filteredTotals: Record<string, { count: number; totalCredits: number }> = {};
  for (const r of filteredDays ?? []) {
    filteredTotals[r.kind] = filteredTotals[r.kind] ?? { count: 0, totalCredits: 0 };
    filteredTotals[r.kind].count += r.count;
    filteredTotals[r.kind].totalCredits += r.totalCredits;
  }
  const kindRows = Object.entries(filteredTotals).sort(
    (a, b) => b[1].totalCredits - a[1].totalCredits,
  );
  const grandTotal = kindRows.reduce((s, [, v]) => s + v.totalCredits, 0);
  const grandCount = kindRows.reduce((s, [, v]) => s + v.count, 0);

  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;

  return (
    <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <BarChart2 className="h-4 w-4" />
                Admin
              </div>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Cost Dashboard</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Generation spend by kind over the last{" "}
                {data?.since ? `30 days (from ${data.since.slice(0, 10)})` : "30 days"}.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition hover:border-[color:var(--border-strong)] hover:text-foreground disabled:opacity-40"
              >
                <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <Link
                to="/admin"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Admin
              </Link>
            </div>
          </header>

          {isLoading && (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load cost stats"}
            </div>
          )}

          {data && !isLoading && (
            <>
              <div className="mb-6 flex gap-2">
                {([7, 30] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setViewDays(d)}
                    className={`rounded-lg border px-4 py-2 text-xs transition ${
                      viewDays === d
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-[color:var(--border-strong)]"
                    }`}
                  >
                    Last {d} days
                  </button>
                ))}
              </div>

              <div className="mb-8 grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Total Aura spent"
                  value={grandTotal.toLocaleString()}
                  sub={`${grandCount.toLocaleString()} generations`}
                  icon={<Coins className="h-5 w-5 text-primary" />}
                />
                <StatCard
                  label="Unique kinds"
                  value={String(kindRows.length)}
                  sub="generation modalities"
                  icon={<TrendingUp className="h-5 w-5 text-primary" />}
                />
                <StatCard
                  label="Avg cost / generation"
                  value={grandCount ? (grandTotal / grandCount).toFixed(1) : "—"}
                  sub="Aura per job"
                  icon={<BarChart2 className="h-5 w-5 text-amber-400" />}
                />
              </div>

              <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-card/40">
                <div className="border-b border-border px-5 py-4 text-sm font-semibold text-foreground">
                  Spend by kind — last {viewDays} days
                </div>
                <div className="divide-y divide-border">
                  {kindRows.length === 0 && (
                    <div className="px-5 py-6 text-sm text-muted-foreground">
                      No succeeded generations in this window.
                    </div>
                  )}
                  {kindRows.map(([kind, stats]) => {
                    const pct = grandTotal > 0 ? (stats.totalCredits / grandTotal) * 100 : 0;
                    return (
                      <div key={kind} className="flex items-center gap-4 px-5 py-3">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${kindStyle(kind)}`}>
                          {kind}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full bg-primary"
                              style={{ width: `${pct.toFixed(1)}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex w-36 items-center justify-end gap-4 text-right">
                          <span className="text-xs text-muted-foreground">
                            {stats.count.toLocaleString()} jobs
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-primary">
                            {stats.totalCredits.toLocaleString()} Aura
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
                <div className="border-b border-border px-5 py-4 text-sm font-semibold text-foreground">
                  Daily breakdown
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-5 py-3 text-left">Date</th>
                        <th className="px-5 py-3 text-left">Kind</th>
                        <th className="px-5 py-3 text-right">Jobs</th>
                        <th className="px-5 py-3 text-right">Aura spent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {(filteredDays ?? []).slice(0, 200).map((row) => (
                        <tr key={`${row.day}-${row.kind}`} className="hover:bg-card/60">
                          <td className="px-5 py-2.5 tabular-nums text-muted-foreground">{row.day}</td>
                          <td className="px-5 py-2.5">
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${kindStyle(row.kind)}`}>
                              {row.kind}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                            {row.count}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-primary">
                            {row.totalCredits.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(filteredDays?.length ?? 0) > 200 && (
                    <p className="px-5 py-3 text-xs text-muted-foreground">
                      Showing first 200 rows. Use the date filter for a narrower window.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
