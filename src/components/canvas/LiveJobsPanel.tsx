import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, CheckCircle2, XCircle, Clock, Image as ImageIcon, Film, Mic } from "lucide-react";

type Gen = {
  id: string;
  kind: string;
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

export function LiveJobsPanel() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Gen[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    // Initial fetch
    supabase
      .from("generations")
      .select("id, kind, status, model, prompt, result_image_url, result_video_url, error, created_at")
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

  return (
    <div className="fixed bottom-20 md:bottom-4 right-4 z-40 w-[300px] max-w-[calc(100vw-2rem)]">
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
          {jobs.length === 0 ? (
            <div className="px-3 py-6 text-center text-white/40 text-xs">No jobs yet. Hit Run.</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {jobs.map((j) => {
                const Icon = KIND_ICON[j.kind] ?? ImageIcon;
                const thumb = j.result_image_url || (j.kind === "video" || j.kind === "lipsync" ? null : null);
                return (
                  <li key={j.id} className="flex gap-2 p-2.5 items-start hover:bg-white/[0.03]">
                    <div className="size-10 shrink-0 rounded-md bg-white/5 overflow-hidden flex items-center justify-center">
                      {thumb ? (
                        <img src={thumb} alt="" className="size-full object-cover" />
                      ) : j.result_video_url ? (
                        <video src={j.result_video_url} className="size-full object-cover" muted />
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
