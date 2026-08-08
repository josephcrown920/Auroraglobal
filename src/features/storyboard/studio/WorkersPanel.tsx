import { useEffect, useState } from "react";
import type { Board } from "@/lib/board-store";
import { listRenderJobs, listWorkers, type RenderJob } from "@/lib/render-jobs";

type Worker = Awaited<ReturnType<typeof listWorkers>>[number];

export function WorkersPanel({ board }: { board: Board }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [w, j] = await Promise.all([listWorkers(), listRenderJobs(board.id)]);
        if (!alive) return;
        setWorkers(w);
        setJobs(j);
        setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load workers");
      }
    };
    load();
    const t = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [board.id]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <span className="text-xs uppercase tracking-widest text-accent">GPU fleet</span>
          <h2 className="text-lg font-semibold">Workers running Seedance 2.5 and LTX</h2>
          <p className="text-sm text-muted-foreground">
            Video jobs are queued here and rendered by your own GPU machines. Start a worker and it
            registers itself automatically.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Worker CLI</div>
          <pre className="overflow-auto rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed">
            {`node cli/aurora-worker.mjs \\
  --api ${origin} \\
  --name my-4090 \\
  --gpu "RTX 4090" \\
  --models seedance-2.5,ltx-video,ltx-2 \\
  --run "./render.sh"`}
          </pre>
          <p className="text-[11px] text-muted-foreground">
            The worker polls for jobs, calls your render command with the prompt, and posts the
            output URL back.
          </p>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Registered workers</h3>
          {workers.length === 0 && (
            <p className="text-sm text-muted-foreground">No workers online yet.</p>
          )}
          {workers.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{w.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {w.gpu ?? "unknown GPU"} · {w.models.join(", ") || "any model"}
                </div>
              </div>
              <span className="text-[11px] text-muted-foreground">
                seen {new Date(w.last_seen_at).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Render jobs</h3>
          {jobs.length === 0 && <p className="text-sm text-muted-foreground">No jobs queued.</p>}
          {jobs.map((j) => (
            <div key={j.id} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px]">{j.id.slice(0, 8)}</span>
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  {j.model} · {j.status}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground line-clamp-2">{j.prompt}</div>
            </div>
          ))}
        </section>

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}