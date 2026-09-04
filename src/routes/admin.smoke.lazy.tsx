import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { runSmokeTest, getSmokeRun, listSmokeRuns } from "@/lib/smoke.functions";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, MinusCircle, ArrowLeft, FlaskConical } from "lucide-react";
import { toast } from "sonner";

export const Route = createLazyFileRoute("/admin/smoke")({
  component: SmokePage,
});

function SmokePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const runFn = useServerFn(runSmokeTest);
  const getFn = useServerFn(getSmokeRun);
  const listFn = useServerFn(listSmokeRuns);

  const list = useQuery({
    queryKey: ["smoke-runs"],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: 5_000,
  });

  const active = useQuery({
    queryKey: ["smoke-run", activeRunId],
    queryFn: () => getFn({ data: { id: activeRunId! } }),
    enabled: !!activeRunId,
    refetchInterval: (q) => {
      const finished = q.state.data?.run?.finished_at;
      return finished ? false : 2_000;
    },
  });

  const runMut = useMutation({
    mutationFn: async () => runFn(),
    onSuccess: (res) => {
      setActiveRunId(res.runId);
      toast.success("Smoke test started — watching live");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }


  const checks = active.data?.checks ?? [];
  const run = active.data?.run;
  const finished = !!run?.finished_at;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Back to admin
          </Link>
        </div>

        <div className="mb-8 flex items-center gap-3">
          <FlaskConical className="size-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Smoke Test</h1>
            <p className="text-sm text-muted-foreground">Run all creative features end-to-end and record pass/fail.</p>
          </div>
        </div>

        <Button
          size="lg"
          onClick={() => runMut.mutate()}
          disabled={runMut.isPending || (activeRunId !== null && !finished)}
          className="mb-8"
        >
          {runMut.isPending || (activeRunId !== null && !finished) ? (
            <><Loader2 className="size-4 animate-spin mr-2" /> Running…</>
          ) : (
            <>Run smoke test</>
          )}
        </Button>

        {activeRunId && (
          <div className="rounded-lg border border-border bg-card p-4 mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Current run</h2>
              <span className="text-xs text-muted-foreground">{activeRunId.slice(0, 8)}</span>
            </div>
            <div className="space-y-2">
              {checks.length === 0 && <p className="text-sm text-muted-foreground">Starting…</p>}
              {checks.map((c: { id: string; step: number; name: string; status: string; latency_ms: number | null; cost_usd: number | null; error: string | null; output_url: string | null; }) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-3 py-2 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon status={c.status} />
                    <span className="font-medium">{c.step}. {c.name}</span>
                    {c.error && <span className="text-xs text-red-400 truncate">— {c.error}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    {c.latency_ms !== null && <span>{(c.latency_ms / 1000).toFixed(1)}s</span>}
                    {c.cost_usd !== null && c.cost_usd > 0 && <span>${Number(c.cost_usd).toFixed(3)}</span>}
                    {c.output_url && <a href={c.output_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">view</a>}
                  </div>
                </div>
              ))}
            </div>
            {finished && (
              <div className="mt-4 border-t border-border pt-3 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Total cost</span>
                <span className="">${Number(run?.total_cost_usd ?? 0).toFixed(3)}</span>
              </div>
            )}
          </div>
        )}

        <h2 className="font-semibold mb-3">Recent runs</h2>
        <div className="space-y-2">
          {(list.data?.runs ?? []).map((r) => {
            const s = (r.summary as { passed?: number; total?: number } | null) ?? null;
            const passed = s?.passed ?? 0;
            const total = s?.total ?? 7;
            return (
              <button
                key={r.id}
                onClick={() => setActiveRunId(r.id)}
                className="w-full flex items-center justify-between rounded-md border border-border/50 bg-card/40 px-3 py-2 text-sm hover:bg-card"
              >
                <span className="text-xs">{r.id.slice(0, 8)}</span>
                <span className="text-muted-foreground">{new Date(r.started_at).toLocaleString()}</span>
                <span>{r.finished_at ? `${passed}/${total} passed` : "running…"}</span>
                <span className="text-xs">${Number(r.total_cost_usd ?? 0).toFixed(3)}</span>
              </button>
            );
          })}
          {list.data?.runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "pass") return <CheckCircle2 className="size-4 text-green-500" />;
  if (status === "fail") return <XCircle className="size-4 text-red-500" />;
  if (status === "skip") return <MinusCircle className="size-4 text-muted-foreground" />;
  return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
}
