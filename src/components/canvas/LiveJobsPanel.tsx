import { useEffect, useState, useRef } from "react";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/billing.functions";
import { Loader2, CheckCircle2, XCircle, Clock, Image as ImageIcon, Film, Mic, Crown } from "lucide-react";
import { Link } from "@tanstack/react-router";

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
};

function StatusBadge({ status }: { status: string }) {
  if (status === "pending" || status === "queued")
    return <span className="inline-flex items-center gap-1 text-amber-300/90 text-[10px]"><Clock className="size-3" /> queued</span>;
  if (status === "running" || status === "processing")
    return <span className="inline-flex items-center gap-1 text-violet-300 text-[10px]"><Loader2 className="size-3 animate-spin" /> running</span>;
  if (status === "done" || status === "completed" || status === "succeeded")
    return <span className="inline-flex items-center gap-1 text-emerald-300 text-[10px]"><CheckCircle2 className="size-3" /> done</span>;
  if (status === "error" || status === "failed")
    return <span className="inline-flex items-center gap-1 text-rose-300 text-[10px]"><XCircle className="size-3" /> error</span>;
  return <span className="text-white/50 text-[10px]">{status}</span>;
}

const QUEUE_WAIT_THRESHOLD_MS = 30_000;

export function LiveJobsPanel() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Gen[]>([]);
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const profileFn = useServerFn(getMyProfile);

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

  const isPro = profile?.plan === "pro" || profile?.isAdmin === true;

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    // Initial fetch
    supabase
      .from("generations")
      .select("id, kind, status, model, prompt, result_image_url, result_video_url, error, created_at, is_watermarked")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (mounted && data) setJobs(data as Gen[]);
      });

    const channel = supabase
      .channel(`gens:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "generations", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setJobs((prev) => {
            if (payload.eventType === "INSERT") {
              return [payload.new as Gen, ...prev].slice(0, 8);
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((j) => (j.id === (payload.new as Gen).id ? (payload.new as Gen) : j));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((j) => j.id !== (payload.old as Gen).id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (!user) return null;
  const active = jobs.filter((j) => j.status === "pending" || j.status === "running" || j.status === "queued").length;

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
        className="w-full flex items-center justify-between px-3 py-2 rounded-t-xl bg-violet-600/90 hover:bg-violet-500 text-white text-xs font-medium shadow-lg shadow-violet-900/40 backdrop-blur"
      >
        <span className="flex items-center gap-2">
          {active > 0 ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkle />}
          Live jobs {active > 0 && <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px]">{active}</span>}
        </span>
        <span className="text-white/70 text-[10px]">{open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className="bg-black/85 border border-violet-500/30 border-t-0 rounded-b-xl max-h-[50vh] overflow-y-auto backdrop-blur">
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
                // Never expose the raw provider URL for watermarked items in the panel.
                // The gallery is the correct place to view watermarked results.
                const thumb = !j.is_watermarked ? j.result_image_url : null;
                return (
                  <li key={j.id} className="flex gap-2 p-2.5 items-start hover:bg-white/[0.03]">
                    <div className="size-10 shrink-0 rounded-md bg-white/5 overflow-hidden flex items-center justify-center">
                      {thumb ? (
                        <img src={thumb} alt="" className="size-full object-cover" />
                      ) : j.result_video_url ? (
                        <AutoplayVideo src={j.result_video_url} className="size-full object-cover" autoPlay={false} />
                      ) : (
                        <Icon className="size-4 text-white/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-white/80 truncate">{j.model || j.kind}</span>
                        <StatusBadge status={j.status} />
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
