// Canvas node — one creative step (image or video), with in-place regenerate,
// branch (+), and "turn into video" actions. Matches the Eromify reference:
// small rounded card, dashed lineage lines flow through Handles.
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Loader2, Plus, RefreshCw, Video, AlertTriangle } from "lucide-react";
import type { ShotNode as ShotNodeType } from "./types";

export function ShotNode({ id, data, selected }: NodeProps<ShotNodeType>) {
  const { label, mediaUrl, mediaType, status, error, onBranch, onRegenerate, onMakeVideo } = data;

  return (
    <div
      className={`group relative w-[132px] rounded-xl border bg-[#0d0710] shadow-lg transition-all ${
        selected ? "border-rose-500/70 shadow-[0_0_0_2px_rgba(225,29,106,0.3)]" : "border-white/10"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-white/30 !bg-[#0d0710]" />
      <Handle type="source" position={Position.Right} className="!size-2 !border-rose-400 !bg-[#0d0710]" />

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-t-xl bg-white/5">
        {mediaUrl && status !== "generating" ? (
          mediaType === "video" ? (
            <video
              src={mediaUrl}
              className="size-full object-cover"
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img src={mediaUrl} alt={label} className="size-full object-cover" loading="lazy" />
          )
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-white/[0.03]">
            {status === "failed" ? (
              <AlertTriangle size={16} className="text-red-400" />
            ) : (
              <Loader2 size={16} className="animate-spin text-rose-400" />
            )}
          </div>
        )}

        {status === "generating" && (
          <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1 text-center text-[8px] font-bold uppercase tracking-widest text-rose-300">
            Rendering…
          </div>
        )}
        {mediaType === "video" && status === "done" && (
          <span className="absolute right-1 top-1 rounded bg-black/70 p-0.5">
            <Video size={9} className="text-white/80" />
          </span>
        )}

        {/* Hover actions */}
        {status !== "generating" && (
          <div className="absolute inset-0 flex items-start justify-end gap-1 bg-black/0 p-1 opacity-0 transition-opacity group-hover:bg-black/20 group-hover:opacity-100">
            <button
              title="Regenerate"
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate(id);
              }}
              className="flex size-5 items-center justify-center rounded-md bg-black/70 text-white/80 hover:text-white"
            >
              <RefreshCw size={10} />
            </button>
            {mediaType === "image" && status === "done" && (
              <button
                title="Turn into video"
                onClick={(e) => {
                  e.stopPropagation();
                  onMakeVideo(id);
                }}
                className="flex size-5 items-center justify-center rounded-md bg-black/70 text-white/80 hover:text-white"
              >
                <Video size={10} />
              </button>
            )}
          </div>
        )}

        {/* Branch button */}
        {status !== "generating" && (
          <button
            title="Branch from this shot"
            onClick={(e) => {
              e.stopPropagation();
              onBranch(id);
            }}
            className="absolute -right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full border border-rose-400/60 bg-[#0d0710] text-rose-300 opacity-0 shadow-[0_0_10px_rgba(225,29,106,0.4)] transition-opacity group-hover:opacity-100"
          >
            <Plus size={10} />
          </button>
        )}
      </div>

      <div className="truncate rounded-b-xl px-2 py-1.5">
        {status === "failed" ? (
          <p className="truncate text-[9px] font-semibold text-red-400">{error ?? "Failed"}</p>
        ) : (
          <p className="truncate text-[9px] font-semibold text-white/50">{label}</p>
        )}
      </div>
    </div>
  );
}
