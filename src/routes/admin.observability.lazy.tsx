import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { adminObservability } from "@/lib/admin-observability.functions";
import { AdminGate, useAdminAutoUnlock } from "@/components/AdminGate";
import { ArrowLeft, Activity, AlertTriangle, Gauge, Loader2, RefreshCw, Bot, Server, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { ReactNode } from "react";

export const Route = createLazyFileRoute("/admin/observability")({
  component: ObservabilityDashboard,
});

function ObservabilityDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useAdminAutoUnlock(!!user);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const observabilityFn = useServerFn(adminObservability);
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-observability"],
    queryFn: () => observabilityFn(),
    enabled: !!user && unlocked,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-primary">
              <Activity className="h-4 w-4" />
              Admin
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Observability</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              API traffic, latency, and errors over the last 24 hours.
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
            {error instanceof Error ? error.message : "Failed to load observability data"}
          </div>
        )}

        {data && !isLoading && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-4">
              <StatCard
                label="Requests (24h)"
                value={data.totalRequests.toLocaleString()}
                sub={data.hitRowCap ? `Capped at ${data.rowCap.toLocaleString()}` : "logged"}
                icon={<Activity className="h-5 w-5 text-primary" />}
              />
              <StatCard
                label="Real traffic"
                value={data.sourceBreakdown.real.toLocaleString()}
                sub="from visitors"
                icon={<Users className="h-5 w-5 text-emerald-400" />}
              />
              <StatCard
                label="Bot traffic"
                value={data.sourceBreakdown.bot.toLocaleString()}
                sub="crawlers / scripts"
                icon={<Bot className="h-5 w-5 text-amber-400" />}
              />
              <StatCard
                label="Internal"
                value={data.sourceBreakdown.internal.toLocaleString()}
                sub="cron / scheduler"
                icon={<Server className="h-5 w-5 text-cyan-400" />}
              />
            </div>

            <section className="mb-8 rounded-2xl border border-border bg-card/40 p-5">
              <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Requests per hour
              </h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.requestsPerHour} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: string) => v.slice(11, 13) + ":00"}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                    />
                    <Tooltip
                      labelFormatter={(label: string) => `${label.slice(11, 13)}:00 UTC`}
                      contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="mb-8 grid gap-6 lg:grid-cols-2">
              <section className="overflow-hidden rounded-2xl border border-border bg-card/40">
                <div className="border-b border-border px-5 py-4 text-sm font-semibold text-foreground">
                  Top endpoints
                </div>
                <div className="divide-y divide-border">
                  {data.topEndpoints.length === 0 && (
                    <div className="px-5 py-6 text-sm text-muted-foreground">No requests logged yet.</div>
                  )}
                  {data.topEndpoints.map((row) => {
                    const max = data.topEndpoints[0]?.count ?? 1;
                    const pct = (row.count / max) * 100;
                    return (
                      <div key={row.endpoint} className="flex items-center gap-4 px-5 py-3">
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                          {row.endpoint}
                        </span>
                        <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full bg-primary"
                            style={{ width: `${pct.toFixed(1)}%` }}
                          />
                        </div>
                        <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                          {row.count.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-border bg-card/40">
                <div className="flex items-center gap-2 border-b border-border px-5 py-4 text-sm font-semibold text-foreground">
                  <Gauge className="h-4 w-4 text-primary" /> p95 latency
                </div>
                <div className="divide-y divide-border">
                  {data.latencyP95.length === 0 && (
                    <div className="px-5 py-6 text-sm text-muted-foreground">Not enough data yet.</div>
                  )}
                  {data.latencyP95.slice(0, 15).map((row) => (
                    <div key={row.endpoint} className="flex items-center gap-4 px-5 py-3">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                        {row.endpoint}
                      </span>
                      <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                        {row.count.toLocaleString()} reqs
                      </span>
                      <span
                        className={`w-16 text-right text-sm font-semibold tabular-nums ${
                          row.p95Ms > 2000 ? "text-destructive" : "text-foreground"
                        }`}
                      >
                        {row.p95Ms.toLocaleString()}ms
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded-2xl border border-border bg-card/40">
              <div className="flex items-center gap-2 border-b border-border px-5 py-4 text-sm font-semibold text-foreground">
                <AlertTriangle className="h-4 w-4 text-destructive" /> Error rate per endpoint
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3 text-left">Endpoint</th>
                      <th className="px-5 py-3 text-right">Requests</th>
                      <th className="px-5 py-3 text-right">Errors</th>
                      <th className="px-5 py-3 text-right">Error rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.errorRates.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-6 text-sm text-muted-foreground">
                          No errors — or not enough traffic to compute a rate yet.
                        </td>
                      </tr>
                    )}
                    {data.errorRates.slice(0, 20).map((row) => (
                      <tr key={row.endpoint} className="hover:bg-card/60">
                        <td className="px-5 py-2.5 font-mono text-xs text-foreground">{row.endpoint}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">{row.total}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">{row.errors}</td>
                        <td
                          className={`px-5 py-2.5 text-right tabular-nums font-semibold ${
                            row.errorRatePct > 10 ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {row.errorRatePct.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: ReactNode }) {
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
