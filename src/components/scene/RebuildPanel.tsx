import { useState } from "react";
import { Loader2, RotateCcw, Sparkles } from "lucide-react";
export function RebuildPanel({ busy, upscaling, canUndo, onRebuild, onUndo, onUpscale }: { busy: boolean; upscaling: boolean; canUndo: boolean; onRebuild: (guidance?: string) => void; onUndo: () => void; onUpscale: (factor: "2x" | "4x") => void }) {
  const [text, setText] = useState("");
  return <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-white/55"><Sparkles className="size-4 text-primary" /> Refine plate</div>
    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Optional direction: remove the shadow, fix the reflection…" className="mb-3 min-h-20 w-full resize-none rounded-lg border border-white/10 bg-black/30 p-3 text-xs outline-none focus:border-primary" />
    <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => onRebuild(text || undefined)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">{busy ? <Loader2 className="size-4 animate-spin" /> : "Rebuild plate"}</button><button disabled={upscaling} onClick={() => onUpscale("2x")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70">{upscaling ? <Loader2 className="size-4 animate-spin" /> : "Upscale 2×"}</button><button disabled={!canUndo} onClick={onUndo} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60"><RotateCcw className="mr-1 inline size-3" />Undo</button></div>
  </section>;
}