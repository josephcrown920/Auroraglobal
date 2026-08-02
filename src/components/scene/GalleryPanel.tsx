import { Download, Film, LayoutGrid, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { GradedImage } from "./GradedImage";
import type { GalleryEntry } from "@/lib/studio-types";

export function GalleryPanel({
  entries,
  onDownload,
  onSendToBoard,
  onSendToTimeline,
  onOpenScene,
}: {
  entries: GalleryEntry[];
  onDownload: (entry: GalleryEntry) => void;
  onSendToBoard: (entry: GalleryEntry) => void;
  onSendToTimeline: (entry: GalleryEntry) => void;
  onOpenScene: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () => entries.filter((entry) => `${entry.itemName} ${entry.label}`.toLowerCase().includes(query.toLowerCase())),
    [entries, query],
  );
  return (
    <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Scene gallery</h2><p className="mt-1 text-xs text-white/40">{entries.length} source and generated frames</p></div>
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/45"><Search className="size-3.5" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search frames" className="w-32 bg-transparent outline-none" /></label>
      </div>
      {!visible.length ? <p className="py-12 text-center text-sm text-white/40">No frames match that search.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((entry) => <article key={entry.id} className="overflow-hidden rounded-xl border border-white/8 bg-white/[.03]"><div className="aspect-video"><GradedImage src={entry.src} grade={entry.grade} alt={entry.label} /></div><div className="p-3"><p className="truncate text-xs font-semibold text-white/80">{entry.itemName}</p><p className="mt-1 truncate text-[10px] uppercase tracking-widest text-white/35">{entry.label}</p><div className="mt-3 flex flex-wrap gap-1.5"><button onClick={() => onDownload(entry)} className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/55"><Download className="mr-1 inline size-3" />Save</button><button onClick={() => onOpenScene(entry.itemId)} className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/55">Open</button><button onClick={() => onSendToBoard(entry)} className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/55"><LayoutGrid className="mr-1 inline size-3" />Board</button><button onClick={() => onSendToTimeline(entry)} className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/55"><Film className="mr-1 inline size-3" />Timeline</button></div></div></article>)}</div>}
    </section>
  );
}