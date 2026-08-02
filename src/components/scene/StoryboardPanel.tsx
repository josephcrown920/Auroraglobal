import { ArrowDown, ArrowUp, Download, Trash2 } from "lucide-react";
import { GradedImage } from "./GradedImage";
import type { Shot } from "@/lib/studio-types";

export function StoryboardPanel({
  shots,
  onPatch,
  onRemove,
  onMove,
  onToggle,
  onToggleAll,
  onExport,
  onExportZip,
  exporting,
}: {
  shots: Shot[];
  onPatch: (id: string, patch: Partial<Shot>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onToggle: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  onExport: (title: string) => void;
  onExportZip: (title: string) => void;
  exporting: string | null;
}) {
  return <section className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Storyboard</h2><p className="mt-1 text-xs text-white/40">{shots.length} shots in order</p></div><div className="flex gap-2"><button onClick={() => onToggleAll(true)} className="rounded-lg border border-white/10 px-2 py-2 text-[10px] text-white/55">Select all</button><button onClick={() => onExport("scene-weaver-board")} disabled={!!exporting} className="rounded-lg bg-primary px-2.5 py-2 text-[10px] text-white"><Download className="mr-1 inline size-3" />Contact sheet</button><button onClick={() => onExportZip("scene-weaver-board")} disabled={!!exporting} className="rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-white/55">ZIP</button></div></div>{!shots.length ? <p className="py-12 text-center text-sm text-white/40">Send frames here from the gallery.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shots.map((shot, index) => <article key={shot.id} className={`overflow-hidden rounded-xl border ${shot.selected ? "border-primary/50" : "border-white/8"}`}><div className="aspect-video"><GradedImage src={shot.src} grade={shot.grade} alt={shot.name} /></div><div className="p-3"><input value={shot.name} onChange={(event) => onPatch(shot.id, { name: event.target.value })} className="w-full bg-transparent text-xs text-white/75 outline-none" /><p className="mt-2 text-[10px] uppercase tracking-widest text-white/35">{index + 1} · {shot.shotType}</p><div className="mt-3 flex gap-1"><button onClick={() => onToggle(shot.id)} className="rounded border border-white/10 px-2 py-1 text-[10px] text-white/55">{shot.selected ? "Selected" : "Select"}</button><button onClick={() => onMove(shot.id, -1)} className="rounded border border-white/10 p-1 text-white/45"><ArrowUp className="size-3" /></button><button onClick={() => onMove(shot.id, 1)} className="rounded border border-white/10 p-1 text-white/45"><ArrowDown className="size-3" /></button><button onClick={() => onRemove(shot.id)} className="ml-auto rounded border border-white/10 p-1 text-red-300/60"><Trash2 className="size-3" /></button></div></div></article>)}</div>}</section>;
}