import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flame, Loader2, Play, RefreshCw, Sparkles, Upload } from "lucide-react";
import { TiktokPostButton } from "@/components/tiktok/TiktokPostButton";
import { getMyTiktokAccount } from "@/lib/tiktok-posting.functions";
import { supabase } from "@/integrations/supabase/client";
import { backoffMs } from "@/lib/poll-backoff";
import { useAuth } from "@/hooks/use-auth";
import {
  startTiktokRemix,
  listTiktokRemixes,
  getTiktokRemix,
  retryTiktokRemixChild,
  type CutStyle,
} from "@/lib/tiktok-remix.functions";
import { ExampleChips } from "@/components/onboarding/ExampleChips";
import { TIKTOK_EXAMPLE_PRESETS } from "@/lib/example-presets";
import { COST_TIKTOK_REMIX_CUT } from "@/lib/pricing";
import { WelcomeTour } from "@/components/onboarding/WelcomeTour";
import { hasCompletedFirstGen, hasDismissedTour, isFirstPageVisit, markFirstGenComplete, markPageVisited } from "@/lib/first-run";
import { useGenerationProgress, type BackendJobStatus } from "@/hooks/use-generation-progress";
import { GenerationErrorCard } from "@/components/ui/GenerationErrorCard";

/**
 * Normalizes backend job status strings to BackendJobStatus.
 * Handles variations: "succeeded" (worker system) → "complete",
 * "done" → "complete", etc. Unknown statuses default to "queued".
 */
function normalizeJobStatus(status: string | null | undefined): BackendJobStatus {
  switch (status) {
    case "queued": return "queued";
    case "processing": return "processing";
    case "finalizing": return "finalizing";
    case "succeeded": case "complete": case "done": return "complete";
    case "failed": case "error": return "failed";
    case null: case undefined: return null;
    default: return "queued";
  }
}

/**
 * Per-job progress card — wraps useGenerationProgress so each card gets its
 * own hook instance (hooks can't be called inside .map() callbacks).
 */
function TiktokJobCard({
  jobStatus,
  label,
  onRetry,
}: {
  jobStatus: BackendJobStatus;
  label: string;
  onRetry?: () => void;
}) {
  const prog = useGenerationProgress({
    jobStatus,
    estimatedMs: 90_000,
    labels: {
      queued: "Waiting in queue…",
      processing: "Rendering your cut…",
      finalizing: "Almost done…",
      done: "Ready",
      error: "Failed",
    },
  });

  if (prog.state === "error") {
    return (
      <div className="aspect-[9/16] rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex flex-col justify-center items-center gap-2 text-center">
        <p className="text-[11px] text-destructive font-medium">Cut failed</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 rounded-lg border border-destructive/40 px-2.5 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/15 transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="aspect-[9/16] rounded-xl border border-border bg-black/40 p-3 flex flex-col justify-between">
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground text-center">{prog.label || label}</p>
      </div>
      <div className="space-y-1">
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] transition-[width] duration-700"
            style={{ width: `${prog.progress}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground text-right tabular-nums">{prog.progress}%</p>
      </div>
    </div>
  );
}

const STYLE_OPTIONS: { value: CutStyle; label: string; hint: string }[] = [
  { value: "auto", label: "Auto", hint: "Aurora picks the strongest hooks straight from your source." },
  { value: "urban_cut", label: "Urban Cut", hint: "Beat-synced luxury outfit showcase — runway energy, multi-angle." },
  { value: "grwm", label: "Get Ready With Me", hint: "Getting-ready arc — mirror, outfit picks, styling, the reveal." },
];

export const Route = createLazyFileRoute("/tiktok")({ component: TiktokRemixPage });

function TiktokRemixPage() {
  const { user } = useAuth();
  const [sourceUrl, setSourceUrl] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [count, setCount] = useState(10);
  const [style, setStyle] = useState<CutStyle>("auto");
  const [activeRemixId, setActiveRemixId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeExampleId, setActiveExampleId] = useState<string | undefined>(undefined);
  const [showTour, setShowTour] = useState(false);

  const startFn = useServerFn(startTiktokRemix);
  const listFn = useServerFn(listTiktokRemixes);
  const getFn = useServerFn(getTiktokRemix);
  const retryFn = useServerFn(retryTiktokRemixChild);
  const tiktokAccountFn = useServerFn(getMyTiktokAccount);

  const list = useQuery({
    queryKey: ["tiktok-remixes"],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: 8000,
  });

  const { data: tiktokAccount } = useQuery({
    queryKey: ["tiktok-account"],
    queryFn: () => tiktokAccountFn(),
    enabled: !!user,
  });

  const detail = useQuery({
    queryKey: ["tiktok-remix", activeRemixId],
    queryFn: () => getFn({ data: { id: activeRemixId! } }),
    enabled: !!activeRemixId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!hasCompletedFirstGen() && isFirstPageVisit("tiktok")) {
      markPageVisited("tiktok");
      const p = TIKTOK_EXAMPLE_PRESETS[0];
      if (p.prompt !== undefined) setBasePrompt(p.prompt);
      if (p.extra?.style) setStyle(p.extra.style as CutStyle);
      if (typeof p.extra?.count === "number") setCount(p.extra.count);
      setActiveExampleId(p.id);
    }
    if (!hasDismissedTour()) {
      const t = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  // Ref lets onGenerate inject a demo URL without hitting React state-batching.
  const sourceUrlOverrideRef = useRef<string | null>(null);

  const startMut = useMutation({
    mutationFn: () => {
      const url = sourceUrlOverrideRef.current ?? sourceUrl;
      sourceUrlOverrideRef.current = null;
      return startFn({ data: { sourceVideoUrl: url, basePrompt: basePrompt || undefined, count, style } });
    },
    onSuccess: (out) => {
      markFirstGenComplete();
      toast.success(`Enqueued ${out.enqueued}/${out.requested} variants`);
      setActiveRemixId(out.remixId);
      list.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to start remix"),
  });

  const retryMut = useMutation({
    mutationFn: (failedJobId: string) => {
      if (!activeRemixId) throw new Error("No active remix");
      return retryFn({ data: { remixId: activeRemixId, failedJobId } });
    },
    onSuccess: () => {
      toast.success("Retrying that cut — the other cuts are untouched");
      detail.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to retry cut"),
  });

  async function onPickFile(f: File | null) {
    if (!f || !user) return;
    setUploading(true);
    try {
      const ext = f.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `${user.id}/tiktok-sources/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("studio").upload(path, f, { contentType: f.type, upsert: false });
      if (error) throw error;
      // Public URL — orchestrator signs studio URLs server-side before fetching.
      const { data } = supabase.storage.from("studio").getPublicUrl(path);
      setSourceUrl(data.publicUrl);
      toast.success("Source uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const childGens = detail.data?.generations ?? [];
  const childJobs = detail.data?.jobs ?? [];
  const completed = useMemo(() => childGens.filter((g) => g.status === "succeeded").length, [childGens]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-3xl font-bold text-foreground">Urban Cuts</h1>
        <p className="mt-3 text-muted-foreground">Sign in to upload a video and spin up 10 variants.</p>
        <Link to="/auth" className="mt-6 inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black no-underline">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      <WelcomeTour show={showTour} onDismiss={() => setShowTour(false)} />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="aurora-kicker inline-flex items-center gap-2 rounded-full border border-pink-300/30 bg-pink-300/10 px-3 py-1 text-pink-200">
            <Flame className="size-3.5" /> Urban Cuts
          </span>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground md:text-5xl">
            One video in. <span className="bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] bg-clip-text text-transparent">Up to 10 cuts out.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Aurora analyzes your source, picks distinct hooks, and runs each one as its own queued render.
          </p>
        </div>
      </header>

      {/* Composer */}
      <section className="mt-8 grid gap-6 aurora-glass rounded-3xl p-5 md:grid-cols-[1.2fr,1fr] md:p-7">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Source video</label>
            <div className="mt-2 flex gap-2">
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://… or upload below"
                className="flex-1 rounded-xl border border-border bg-black/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-pink-400/60"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="aurora-glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-white/10 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                Upload
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Brief (optional)</label>
            <textarea
              value={basePrompt}
              onChange={(e) => setBasePrompt(e.target.value)}
              placeholder="e.g. moody neon city pop track, 9:16, lots of close-ups"
              rows={3}
              className="mt-2 w-full rounded-xl border border-border bg-black/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-pink-400/60"
            />
          </div>

          <ExampleChips
            presets={TIKTOK_EXAMPLE_PRESETS}
            activeId={activeExampleId}
            onSelect={(preset) => {
              if (preset.prompt !== undefined) setBasePrompt(preset.prompt);
              if (preset.extra?.style) setStyle(preset.extra.style as CutStyle);
              if (typeof preset.extra?.count === "number") setCount(preset.extra.count);
              setActiveExampleId(preset.id);
            }}
            onGenerate={() => {
              const preset = TIKTOK_EXAMPLE_PRESETS.find((p) => p.id === activeExampleId);
              if (!sourceUrl && typeof preset?.extra?.sampleVideoUrl === "string") {
                sourceUrlOverrideRef.current = preset.extra.sampleVideoUrl;
              }
              startMut.mutate();
            }}
            label="Try an example:"
          />

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Cut style</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {STYLE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setStyle(o.value)}
                  aria-pressed={style === o.value}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold leading-tight transition ${
                    style === o.value
                      ? "border-pink-400/60 bg-white/[0.08] text-foreground"
                      : "border-border bg-black/40 text-muted-foreground hover:bg-white/[0.05]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{STYLE_OPTIONS.find((o) => o.value === style)?.hint}</p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">How many cuts</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range" min={1} max={10} step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="flex-1 accent-pink-500"
              />
              <span className="w-10 text-right font-bold text-foreground">{count}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Each cut reserves {COST_TIKTOK_REMIX_CUT} Aura. Reservations are released if a job fails.</p>
          </div>

          <button
            type="button"
            disabled={!sourceUrl || startMut.isPending}
            onClick={() => startMut.mutate()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {startMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Remix into {count} cuts
          </button>
          {!sourceUrl && !startMut.isPending && (
            <p className="-mt-2 text-center text-[11px] text-muted-foreground">
              Add a source video above (paste a link or upload) to enable this button.
            </p>
          )}

          <GenerationErrorCard
            visible={startMut.isError}
            error={startMut.error instanceof Error ? startMut.error.message : "Failed to start remix"}
            onRetry={() => startMut.mutate()}
          />
        </div>

        <aside className="rounded-2xl border border-border bg-black/30 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent remixes</h3>
          <div className="mt-3 space-y-2">
            {(list.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No remixes yet.</p>}
            {(list.data ?? []).map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRemixId(r.id)}
                className={`block w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                  activeRemixId === r.id ? "border-pink-400/60 bg-white/[0.06]" : "border-border bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between text-foreground">
                  <span className="font-semibold">{r.target_count} cuts</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{r.status}</span>
                </div>
                <p className="mt-1 truncate text-muted-foreground">{r.prompt || "—"}</p>
              </button>
            ))}
          </div>
        </aside>
      </section>

      {/* Detail */}
      {activeRemixId && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">
              {completed}/{childGens.length || childJobs.length} ready
            </h2>
            <button
              onClick={() => detail.refetch()}
              className="aurora-glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-white/10"
            >
              <RefreshCw className="size-3" /> Refresh
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {childGens.length === 0 && childJobs.map((j) => (
              <TiktokJobCard
                key={j.id}
                jobStatus={normalizeJobStatus(j.status)}
                label={j.status}
                onRetry={j.status === "failed" || j.status === "error" ? () => retryMut.mutate(j.id) : undefined}
              />
            ))}
            {childGens.map((g) => (
              <div key={g.id} className="group relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-black/60">
                {g.result_video_url ? (
                  <AutoplayVideo
                    src={g.result_video_url}
                    className="absolute inset-0 size-full object-cover"
                    autoPlay={false}
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                  />
                ) : (
                  <TiktokJobCard
                    jobStatus={normalizeJobStatus(g.status)}
                    label={g.status}
                    onRetry={
                      g.status === "failed"
                        ? () => {
                            const linkedJob = childJobs.find((j) => j.generation_id === g.id);
                            if (linkedJob) retryMut.mutate(linkedJob.id);
                            else toast.error("Couldn't find the failed job to retry");
                          }
                        : undefined
                    }
                  />
                )}
                <div className="absolute bottom-2 left-2 right-2 rounded bg-black/60 p-1.5 text-[10px] leading-snug text-white/85 backdrop-blur">
                  {g.prompt.slice(0, 80)}
                </div>
                {g.result_video_url && (
                  <>
                    <span className="absolute top-2 right-2 grid place-items-center size-7 rounded-full bg-white/15 backdrop-blur">
                      <Play className="size-3 fill-white text-white" />
                    </span>
                    <div className="absolute bottom-10 left-2 right-2">
                      <TiktokPostButton
                        compact
                        videoUrl={g.result_video_url}
                        generationId={g.id}
                        title={g.prompt?.slice(0, 150)}
                        isConnected={tiktokAccount?.connected}
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Optional Motion Control card ── */}
      {childGens.some((g) => g.result_video_url) && (
        <section className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary/70">Motion Control</span>
            <span className="text-[10px] rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary/50">Optional</span>
          </div>
          <p className="text-xs text-white/50 leading-relaxed mb-3">
            Want to go further? Take any of your generated clips into Motion Control — upload a phone performance recording to transfer your real movement into an AI scene.
          </p>
          <Link
            to="/motion"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/15 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors"
          >
            Open Motion Control →
          </Link>
        </section>
      )}

      {/* Worker hint */}
      <ClientWorkerTicker enabled={!!activeRemixId} />
    </div>
  );
}

/**
 * Client-side worker pulse: while a remix detail is open, the page pings the
 * tick endpoint every ~6s to nudge jobs forward even without pg_cron wired up.
 * Production should also configure pg_cron to call /api/public/jobs/tick.
 */
function ClientWorkerTicker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let attempt = 0;
    async function pulse() {
      if (cancelled) return;
      try {
        const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
        if (!key) return;
        await fetch(`/api/public/jobs/tick`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: key },
          body: "{}",
        });
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        // Doubling backoff: 6 s → 12 s → 20 s cap, so stale tabs don't hammer the API.
        // Uses backoffMs with factor=2 and a 6 s base rather than the polling helper's default.
        const delay = backoffMs(attempt, 6_000, 2, 20_000);
        attempt++;
        setTimeout(pulse, delay);
      }
    }
    pulse();
    return () => { cancelled = true; };
  }, [enabled]);
  return null;
}