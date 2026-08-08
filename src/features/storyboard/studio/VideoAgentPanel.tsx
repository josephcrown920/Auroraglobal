import { useEffect, useRef, useState } from "react";
import type { Board, ShotNode } from "@/lib/board-store";
import { getRenderJob, queueRenderJob, RENDER_MODELS, type RenderJob } from "@/lib/render-jobs";

export function VideoAgentPanel({
  shot,
  board,
  onChange,
}: {
  shot: ShotNode;
  board: Board;
  onChange: (patch: Partial<ShotNode>) => void;
}) {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setJob(null);
    setError(null);
  }, [shot.id]);

  useEffect(() => {
    const id = shot.jobId;
    if (!id) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await getRenderJob(id);
        if (cancelled || !next) return;
        setJob(next);
        if (next.status === "completed" && next.output_url) {
          onChange({ videoUrl: next.output_url });
        }
        if (next.status === "completed" || next.status === "failed") {
          if (timer.current) clearInterval(timer.current);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read job status");
        if (timer.current) clearInterval(timer.current);
      }
    };
    poll();
    timer.current = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot.jobId]);

  function buildVideoPrompt() {
    const chars = board.characters
      .map((c) => `${c.name}: ${c.description}. Wardrobe: ${c.wardrobe}. Props: ${c.props}`)
      .join(" | ");
    return (
      shot.videoPrompt?.trim() ||
      `${shot.title}. ${shot.frame}. Mood: ${shot.mood}. Style: ${board.stylePreset}. ${
        chars ? `Characters — ${chars}.` : ""
      }`
    );
  }

  async function queue() {
    setBusy(true);
    setError(null);
    try {
      const created = await queueRenderJob({
        boardId: board.id,
        shotId: shot.id,
        model: shot.videoModel ?? "seedance-2.5",
        prompt: buildVideoPrompt(),
        inputImageUrl: shot.imageUrl?.startsWith("http") ? shot.imageUrl : null,
        params: { seconds: shot.duration, fps: 24 },
      });
      setJob(created);
      onChange({ jobId: created.id, videoUrl: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not queue the job");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-accent/40 bg-accent/5 p-3">
      <div className="text-xs uppercase tracking-widest text-accent">Video agent</div>

      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Model</span>
        <select
          className="sb-input"
          value={shot.videoModel ?? "seedance-2.5"}
          onChange={(e) => onChange({ videoModel: e.target.value })}
        >
          {RENDER_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Video prompt
        </span>
        <textarea
          rows={4}
          className="sb-input"
          placeholder="Motion, camera move, pacing…"
          value={shot.videoPrompt ?? ""}
          onChange={(e) => onChange({ videoPrompt: e.target.value })}
        />
      </label>

      <button
        onClick={queue}
        disabled={busy}
        className="w-full rounded-md bg-accent text-accent-foreground px-3 py-2 text-sm font-medium disabled:opacity-60"
      >
        {busy ? "Queuing…" : "Queue on GPU workers"}
      </button>

      {job && (
        <p className="text-xs text-muted-foreground">
          Job <span className="font-mono">{job.id.slice(0, 8)}</span> · {job.status}
          {job.error ? ` · ${job.error}` : ""}
        </p>
      )}
      {shot.videoUrl && (
        <video src={shot.videoUrl} controls className="w-full rounded-lg border border-border" />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}