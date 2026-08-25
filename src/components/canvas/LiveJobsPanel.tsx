import { useEffect, useState, useMemo, useCallback } from "react";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/billing.functions";
import { listGenerations } from "@/lib/studio.functions";
import { cancelMyJob } from "@/lib/jobs.functions";
import { publishGeneration } from "@/lib/share.functions";
import { saveAssetToDisk } from "@/lib/save";
import { ShareMenu } from "@/components/share/ShareMenu";
import { Loader2, CheckCircle2, XCircle, Clock, Image as ImageIcon, Film, Mic, Crown, X, Download } from "lucide-react";
import { Link } from "@tanstack/react-router";

// Gen type mirrors the masked shape returned by listGenerations server fn.
// result_image_url is the signed proxy URL for watermarked items (or raw for Pro).
// result_video_url is null for watermarked items (video proxy deferred; upgrade CTA shown).
type Gen = {
  id: string;
  kind: string;
  is_watermarked?: boolean;
  status: string;
  model: string | null;
  prompt: string;
  result_image_url: string | null;
  result_video_url: string | null;
  error: string | null;
  created_at: string;
};

const KIND_ICON: Record<string, typeof ImageIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Mic,
  lipsync: Film,
  split: Film,
  motion: Film,
};

// Human-readable kind labels — shown when there's no provider model name yet.
const KIND_LABEL: Record<string, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  lipsync: "Lip Sync",
  motion: "Motion",
  upscale: "Upscale",
  ugc_ad: "UGC Ad",
  performance_reskin: "Reskin",
  kids_story: "Kids Story",
  autocut: "AutoCut",
  product_demo: "Demo",
};

function friendlyLabel(model: string | null, kind: string): string {
  if (model) {
    // Strip long provider prefixes for readability
    return model.replace(/^(fal-ai\/|replicate\/|replit\/|google\/|openai\/|xai\/)/, "");
  }
  return KIND_LABEL[kind] ?? kind;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending" || status === "queued")
    return <span className="inline-flex items-center gap-1 text-amber-300/90 text-[10px]"><Clock className="size-3" /> queued</span>;
  if (status === "running" || status === "processing")
    return <span className="inline-flex items-center gap-1 text-cyan-300 text-[10px]"><Loader2 className="size-3 animate-spin" /> running</span>;
  if (status === "done" || status === "completed" || status === "succeeded" || status === "complete")
    return <span className="inline-flex items-center gap-1 text-emerald-300 text-[10px]"><CheckCircle2 className="size-3" /> done</span>;
  if (status === "error" || status === "failed")
    return <span className="inline-flex items-center gap-1 text-rose-300 text-[10px]"><XCircle className="size-3" /> error</span>;
  return <span className="text-white/50 text-[10px]">{status}</span>;
}

const QUEUE_WAIT_THRESHOLD_MS = 30_000;
const RECENT_WINDOW_MS = 30 * 60 * 1_000; // show completed/failed for 30 min
// Queued/pending jobs older than this are considered stale and hidden from the
// "active" filter — they're either stuck in retry backoff or orphaned legacy rows.
// They still show if created within RECENT_WINDOW_MS so you can see a failed job.
const STALE_QUEUED_MS = 30 * 60 * 1_000; // 30 min
const POLL_INTERVAL_MS = 3_000;
const DISMISSED_KEY = "aurora.live-jobs.dismissed";

function getDismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]") as string[]); }
  catch { return new Set(); }
}
function addDismissed(id: string) {
  try {
    const s = getDismissed();
    s.add(id);
    // Keep only the last 200 ids to avoid unbounded growth
    const arr = Array.from(s).slice(-200);
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}

export function LiveJobsPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<Set<string>>(getDismissed);
  const profileFn = useServerFn(getMyProfile);
  const listFn = useServerFn(listGenerations);
  const cancelFn = useServerFn(cancelMyJob);

  // Tick every 5 s to recompute queue-wait time without heavy re-renders.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn(),
    enabled: !!user,
    staleTime: 60_000,
  });

  // Poll listGenerations — server fn applies watermark masking before the
  // response is sent, so raw provider URLs never reach this component.
  const { data: genData } = useQuery({
    queryKey: ["live-jobs", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 0,
  });

  const publishFn = useServerFn(publishGeneration);

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["live-jobs"] }),
  });

  const dismiss = useCallback((id: string) => {
    addDismissed(id);
    setDismissed(new Set(getDismissed()));
  }, []);

  const isPro = !!profile?.is_pro || profile?.isAdmin === true;

  // Show jobs that are:
  //   - actively running/processing (any age)
  //   - queued/pending ONLY if created within the stale threshold (not old orphans)
  //   - completed/failed if created within the 30-min recency window
  // Also exclude user-dismissed entries.
  const jobs = useMemo<Gen[]>(() => {
    if (!genData?.items) return [];
    const cutoff = now - RECENT_WINDOW_MS;
    const staleQueuedCutoff = now - STALE_QUEUED_MS;
    return (genData.items as Gen[])
      .filter((j) => {
        if (dismissed.has(j.id)) return false;
        const createdMs = new Date(j.created_at).getTime();
        if (j.status === "running" || j.status === "processing") return true;
        if (j.status === "pending" || j.status === "queued") {
          // Only show queued jobs that are reasonably recent; hide stale orphans.
          return createdMs > staleQueuedCutoff;
        }
        // Completed / failed: show if created within 30-min window.
        return createdMs > cutoff;
      })
      .slice(0, 8);
  }, [genData, now, dismissed]);

  if (!user) return null;

  const active = jobs.filter((j) => j.status === "pending" || j.status === "running" || j.status === "queued" || j.status === "processing").length;

  // Show upgrade nudge when a Free user has a queued/pending job waiting > 30 s.
  const longQueuedJob = !isPro && jobs.find(
    (j) =>
      (j.status === "queued" || j.status === "pending") &&
      now - new Date(j.created_at).getTime() > QUEUE_WAIT_THRESHOLD_MS,
  );

  return (
    <div className="phone-edge-right fixed bottom-20 z-40 w-[300px] max-w-[calc(100vw-2rem)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-t-xl bg-red-600/90 hover:bg-red-500 text-white text-xs font-medium shadow-lg shadow-red-900/40 backdrop-blur"
      >
        <span className="flex items-center gap-2">
          {active > 0 ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkle />}
          Live jobs {active > 0 && <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">{active}</span>}
        </span>
        <span className="text-white/70 text-[10px]">{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className="bg-black/85 border border-red-500/30 border-t-0 rounded-b-xl max-h-[50vh] overflow-y-auto backdrop-blur">
          {longQueuedJob && (
            <div className="mx-2 my-2 rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/30 p-2.5 flex items-start gap-2">
              <Crown className="size-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-amber-300 leading-tight">
                  Waiting in queue
                </p>
                <p className="text-[10px] text-white/60 mt-0.5 leading-tight">
                  Pro members skip the queue and render first.
                </p>
                <Link
                  to="/billing"
                  className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-amber-400/90 hover:bg-amber-300 text-black text-[10px] font-bold transition-colors"
                >
                  Upgrade to Pro →
                </Link>
              </div>
            </div>
          )}
          {jobs.length === 0 ? (
            <div className="px-3 py-6 text-center text-white/40 text-xs">No jobs yet. Hit Run.</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {jobs.map((j) => {
                const Icon = KIND_ICON[j.kind] ?? ImageIcon;
                const thumb = j.result_image_url;
                const videoThumb = j.result_video_url;
                const isQueued = j.status === "queued" || j.status === "pending";
                const isTerminal = j.status === "done" || j.status === "completed" || j.status === "succeeded" || j.status === "complete" || j.status === "error" || j.status === "failed";
                return (
                  <li key={j.id} className="flex gap-2 p-2.5 items-start hover:bg-white/[0.03] group">
                    <div className="size-10 shrink-0 rounded-md bg-white/5 overflow-hidden flex items-center justify-center">
                      {thumb ? (
                        <img src={thumb} alt="" className="size-full object-cover" />
                      ) : videoThumb ? (
                        <AutoplayVideo src={videoThumb} className="size-full object-cover" autoPlay={false} />
                      ) : (
                        <Icon className="size-4 text-white/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-white/80 truncate">{friendlyLabel(j.model, j.kind)}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <StatusBadge status={j.status} />
                          {/* Cancel button for queued jobs; dismiss for terminal/stale ones */}
                          {isQueued ? (
                            <button
                              onClick={() => cancelMut.mutate(j.id)}
                              disabled={cancelMut.isPending}
                              className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded text-white/40 hover:text-rose-400 transition-opacity"
                              title="Cancel job"
                            >
                              <X className="size-3" />
                            </button>
                          ) : isTerminal ? (
                            <>
                              {(thumb || videoThumb) && (
                                <>
                                  <button
                                    onClick={() => {
                                      const url = videoThumb || thumb;
                                      if (url) saveAssetToDisk(url, `aurora-${j.id.slice(0, 8)}.${videoThumb ? "mp4" : "png"}`);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded text-white/40 hover:text-emerald-400 transition-opacity"
                                    title="Download"
                                  >
                                    <Download className="size-3" />
                                  </button>
                                  <ShareMenu
                                    compact
                                    triggerClassName="opacity-0 group-hover:opacity-100 ml-0.5 p-0.5 rounded text-white/40 hover:text-red-400 transition-opacity"
                                    getShareTarget={async () => {
                                      const r = await publishFn({ data: { id: j.id } });
                                      const url = videoThumb || thumb;
                                      return {
                                        url: `${window.location.origin}${r.url}`,
                                        text: j.prompt ?? undefined,
                                        assetUrl: url,
                                        filename: `aurora-${j.id.slice(0, 8)}.${videoThumb ? "mp4" : "png"}`,
                                      };
                                    }}
                                  />
                                </>
                              )}
                              <button
                                onClick={() => dismiss(j.id)}
                                className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded text-white/40 hover:text-white/70 transition-opacity"
                                title="Dismiss"
                              >
                                <X className="size-3" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-[10px] text-white/50 line-clamp-2 mt-0.5">{j.prompt || j.error || "—"}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Sparkle() {
  return <span className="size-1.5 rounded-full bg-white inline-block" />;
}
