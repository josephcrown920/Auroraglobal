import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Flame, Loader2, Play, RefreshCw, Sparkles, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  startTiktokRemix,
  listTiktokRemixes,
  getTiktokRemix,
} from "@/lib/tiktok-remix.functions";

export const Route = createFileRoute("/tiktok")({
  component: TiktokRemixPage,
  head: () => ({
    meta: [
      { title: "TikTok Remix Factory — Aurora" },
      { name: "description", content: "Upload one video. Aurora remixes it into up to 30 TikTok-ready cuts from different hooks, angles, and beats." },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-8 text-sm text-red-400">Error: {error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-white/60">Not found.</div>,
});

function TiktokRemixPage() {
  const { user } = useAuth();
  const [sourceUrl, setSourceUrl] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [count, setCount] = useState(10);
  const [activeRemixId, setActiveRemixId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const startFn = useServerFn(startTiktokRemix);
  const listFn = useServerFn(listTiktokRemixes);
  const getFn = useServerFn(getTiktokRemix);

  const list = useQuery({
    queryKey: ["tiktok-remixes"],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: 8000,
  });

  const detail = useQuery({
    queryKey: ["tiktok-remix", activeRemixId],
    queryFn: () => getFn({ data: { id: activeRemixId! } }),
    enabled: !!activeRemixId,
    refetchInterval: 5000,
  });

  const startMut = useMutation({
    mutationFn: () =>
      startFn({ data: { sourceVideoUrl: sourceUrl, basePrompt: basePrompt || undefined, count } }),
    onSuccess: (out) => {
      toast.success(`Enqueued ${out.enqueued}/${out.requested} variants`);
      setActiveRemixId(out.remixId);
      list.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to start remix"),
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
        <h1 className="text-3xl font-bold text-white">TikTok Remix Factory</h1>
        <p className="mt-3 text-white/70">Sign in to upload a video and spin up 30 variants.</p>
        <Link to="/auth" className="mt-6 inline-flex items-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black no-underline">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-300/30 bg-pink-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-pink-200">
            <Flame className="size-3.5" /> TikTok Remix Factory
          </span>
          <h1 className="mt-3 text-3xl font-extrabold text-white md:text-5xl">
            One video in. <span className="bg-gradient-to-r from-[#25F4EE] to-[#FE2C55] bg-clip-text text-transparent">Up to 30 cuts out.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-white/65">
            Aurora analyzes your source, picks distinct hooks, and runs each one as its own queued render.
          </p>
        </div>
      </header>

      {/* Composer */}
      <section className="mt-8 grid gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:grid-cols-[1.2fr,1fr] md:p-7">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-white/55">Source video</label>
            <div className="mt-2 flex gap-2">
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://… or upload below"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-pink-400/60"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
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
            <label className="text-xs font-bold uppercase tracking-widest text-white/55">Brief (optional)</label>
            <textarea
              value={basePrompt}
              onChange={(e) => setBasePrompt(e.target.value)}
              placeholder="e.g. moody neon city pop track, 9:16, lots of close-ups"
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-pink-400/60"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-white/55">How many cuts</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range" min={1} max={30} step={1}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="flex-1 accent-pink-500"
              />
              <span className="w-10 text-right font-bold text-white">{count}</span>
            </div>
            <p className="mt-1 text-[11px] text-white/40">Each cut reserves 5 credits. Reservations are released if a job fails.</p>
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
        </div>

        <aside className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white/55">Recent remixes</h3>
          <div className="mt-3 space-y-2">
            {(list.data ?? []).length === 0 && <p className="text-xs text-white/40">No remixes yet.</p>}
            {(list.data ?? []).map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRemixId(r.id)}
                className={`block w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                  activeRemixId === r.id ? "border-pink-400/60 bg-white/[0.06]" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between text-white">
                  <span className="font-semibold">{r.target_count} cuts</span>
                  <span className="text-[10px] uppercase tracking-widest text-white/50">{r.status}</span>
                </div>
                <p className="mt-1 truncate text-white/55">{r.prompt || "—"}</p>
              </button>
            ))}
          </div>
        </aside>
      </section>

      {/* Detail */}
      {activeRemixId && (
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">
              {completed}/{childGens.length || childJobs.length} ready
            </h2>
            <button
              onClick={() => detail.refetch()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              <RefreshCw className="size-3" /> Refresh
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {childGens.length === 0 && childJobs.map((j) => (
              <div key={j.id} className="aspect-[9/16] rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/50">
                {j.status}
              </div>
            ))}
            {childGens.map((g) => (
              <div key={g.id} className="group relative aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-black/60">
                {g.result_video_url ? (
                  <video
                    src={g.result_video_url}
                    className="absolute inset-0 size-full object-cover"
                    muted
                    loop
                    playsInline
                    onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                    onMouseLeave={(e) => e.currentTarget.pause()}
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-[11px] text-white/50">
                    {g.status === "failed" ? "Failed" : (
                      <span className="inline-flex items-center gap-1.5"><Loader2 className="size-3 animate-spin" /> {g.status}</span>
                    )}
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 rounded bg-black/60 p-1.5 text-[10px] leading-snug text-white/85 backdrop-blur">
                  {g.prompt.slice(0, 80)}
                </div>
                {g.result_video_url && (
                  <span className="absolute top-2 right-2 grid place-items-center size-7 rounded-full bg-white/15 backdrop-blur">
                    <Play className="size-3 fill-white text-white" />
                  </span>
                )}
              </div>
            ))}
          </div>
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
    async function pulse() {
      try {
        const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
        if (!key) return;
        await fetch(`/api/public/jobs/tick`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: key },
          body: "{}",
        });
        void url;
      } catch {
        /* ignore */
      }
    }
    pulse();
    const t = setInterval(() => { if (!cancelled) pulse(); }, 6000);
    return () => { cancelled = true; clearInterval(t); };
  }, [enabled]);
  return null;
}