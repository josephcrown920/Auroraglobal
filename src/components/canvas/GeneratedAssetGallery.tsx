import { useEffect, useMemo, useRef, useState } from "react";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listGenerations } from "@/lib/studio.functions";
import { publishGeneration } from "@/lib/share.functions";
import { saveAssetToDisk } from "@/lib/save";
import { ShareMenu } from "@/components/share/ShareMenu";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Image as ImageIcon,
  Film,
  Mic,
  Download,
  ExternalLink,
  PanelRightClose,
  PanelRightOpen,
  LayoutGrid,
} from "lucide-react";

// Gen type mirrors the masked shape returned by listGenerations server fn —
// result urls are already watermark-proxied / signed server-side.
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
  caption_burn: Film,
  lyric_video: Film,
};

function StatusIcon({ status }: { status: string }) {
  if (status === "pending" || status === "queued")
    return <Clock className="size-3 text-amber-300/90" />;
  if (status === "running" || status === "processing")
    return <Loader2 className="size-3 animate-spin text-violet-300" />;
  if (status === "done" || status === "completed" || status === "succeeded" || status === "complete")
    return <CheckCircle2 className="size-3 text-emerald-400" />;
  if (status === "error" || status === "failed")
    return <XCircle className="size-3 text-rose-400" />;
  return <Clock className="size-3 text-white/40" />;
}

const POLL_INTERVAL_MS = 4_000;

export function GeneratedAssetGallery() {
  const { user } = useAuth();
  const publishFn = useServerFn(publishGeneration);
  // Start collapsed so the panel never covers the canvas on narrow screens;
  // auto-open the first time this session actually produces an asset.
  const [open, setOpen] = useState(false);
  const autoOpenedRef = useRef(false);
  const [sessionStart] = useState(() => Date.now());
  const listFn = useServerFn(listGenerations);

  const { data } = useQuery({
    queryKey: ["canvas-asset-gallery", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 0,
  });

  // Session-produced only: anything created since this canvas tab was opened.
  // A small grace window absorbs clock skew between client and server.
  const assets = useMemo<Gen[]>(() => {
    if (!data?.items) return [];
    const cutoff = sessionStart - 5_000;
    return (data.items as Gen[])
      .filter((g) => new Date(g.created_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [data, sessionStart]);

  useEffect(() => {
    if (assets.length > 0 && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setOpen(true);
    }
  }, [assets.length]);

  if (!user) return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`fixed top-20 z-30 flex items-center gap-1.5 px-2.5 py-2 rounded-l-xl border border-r-0 border-white/10 bg-[oklch(0.13_0.04_290/0.92)] backdrop-blur-xl text-[13px] uppercase tracking-[0.15em] text-white/70 hover:text-white transition-[right] duration-200 ${
          open ? "right-[min(18rem,85vw)]" : "right-0"
        }`}
        title={open ? "Collapse asset gallery" : "Show generated assets"}
      >
        {open ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
        {!open && <span>Gallery{assets.length > 0 ? ` · ${assets.length}` : ""}</span>}
      </button>
      {open && (
        <aside className="fixed top-14 right-0 bottom-0 z-20 w-72 max-w-[85vw] flex flex-col border-l border-white/10 bg-[oklch(0.12_0.035_290/0.96)] backdrop-blur-xl">
          <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between shrink-0">
            <span className="text-sm uppercase tracking-[0.15em] text-white/80 flex items-center gap-1.5">
              <LayoutGrid className="size-3.5 text-primary" /> Generated assets
            </span>
            <span className="text-[13px] text-white/40">{assets.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {assets.length === 0 ? (
              <div className="px-3 py-8 text-center text-xs text-white/40">
                Nothing yet — run the pipeline to see assets here.
              </div>
            ) : (
              assets.map((a) => {
                const Icon = KIND_ICON[a.kind] ?? ImageIcon;
                const url = a.result_video_url || a.result_image_url;
                return (
                  <div key={a.id} className="p-2.5 flex gap-2.5 hover:bg-white/[0.03]">
                    <div className="size-14 shrink-0 rounded-lg bg-white/5 overflow-hidden grid place-items-center">
                      {a.result_video_url ? (
                        <AutoplayVideo src={a.result_video_url} className="size-full object-cover" autoPlay={false} />
                      ) : a.result_image_url ? (
                        <img src={a.result_image_url} alt="" className="size-full object-cover" />
                      ) : (
                        <Icon className="size-4 text-white/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[13px] uppercase tracking-wide text-white/60 flex items-center gap-1">
                          <Icon className="size-3" /> {a.kind}
                        </span>
                        <StatusIcon status={a.status} />
                      </div>
                      <p className="text-[13px] text-white/50 line-clamp-2 mt-0.5">{a.prompt || a.error || "—"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-white/30">{new Date(a.created_at).toLocaleTimeString()}</span>
                        {url && (
                          <div className="ml-auto flex items-center gap-1.5">
                            <button
                              onClick={() => window.open(url, "_blank")}
                              className="text-white/40 hover:text-white"
                              title="Open"
                            >
                              <ExternalLink className="size-3" />
                            </button>
                            <button
                              onClick={() => saveAssetToDisk(url, `aurora-${a.id}.${a.result_video_url ? "mp4" : "png"}`)}
                              className="text-white/40 hover:text-white"
                              title="Save"
                            >
                              <Download className="size-3" />
                            </button>
                            <ShareMenu
                              compact
                              triggerClassName="text-white/40 hover:text-white"
                              getShareTarget={async () => {
                                const r = await publishFn({ data: { id: a.id } });
                                return {
                                  url: `${window.location.origin}${r.url}`,
                                  text: a.prompt ?? undefined,
                                  assetUrl: url,
                                  filename: `aurora-${a.id}.${a.result_video_url ? "mp4" : "png"}`,
                                };
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}
    </>
  );
}
