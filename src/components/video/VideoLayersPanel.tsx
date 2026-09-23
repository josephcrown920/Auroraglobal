import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, GripVertical, Image as ImageIcon, Lock, LockOpen, Music2, Plus, ScanSearch, Trash2, Type, Video, Layers3, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mapVideoObjects } from "@/lib/video-vision.functions";

type VisionObject = { label: string; x: number; y: number; width: number; height: number; confidence?: number };

export type VideoEditorLayer = {
  id: string;
  type: "video" | "image" | "text" | "audio" | "overlay";
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  x: number;
  y: number;
  scale: number;
  rotation?: number;
  content?: string;
  sourceKind?: "url" | "file" | "emoji" | "text";
  startSec?: number;
  durationSec?: number;
  zIndex?: number;
  visionObjects?: VisionObject[];
};

const ICONS = { video: Video, image: ImageIcon, text: Type, audio: Music2, overlay: Layers3 };
const CANVAS_W = 720;
const CANVAS_H = 405;
const DEFAULT_LAYER_DURATION = 4;

function normalizeLayer(layer: VideoEditorLayer, index: number): VideoEditorLayer {
  return {
    ...layer,
    x: Number.isFinite(layer.x) ? layer.x : 0,
    y: Number.isFinite(layer.y) ? layer.y : 0,
    scale: Number.isFinite(layer.scale) ? layer.scale : 1,
    opacity: Number.isFinite(layer.opacity) ? layer.opacity : 1,
    rotation: Number.isFinite(layer.rotation) ? layer.rotation : 0,
    startSec: Number.isFinite(layer.startSec) ? layer.startSec : 0,
    durationSec: Number.isFinite(layer.durationSec) && (layer.durationSec ?? 0) > 0 ? layer.durationSec : DEFAULT_LAYER_DURATION,
    zIndex: Number.isFinite(layer.zIndex) ? layer.zIndex : index,
    visible: layer.visible !== false,
    locked: layer.locked === true,
  };
}

function makeLayer(type: VideoEditorLayer["type"], index: number, content = ""): VideoEditorLayer {
  return normalizeLayer({
    id: crypto.randomUUID(),
    type,
    name: type === "text" ? `Text ${index}` : `${type[0].toUpperCase()}${type.slice(1)} ${index}`,
    visible: true,
    locked: false,
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    content: type === "text" ? "Your text" : content,
    sourceKind: type === "text" ? "text" : "url",
    startSec: 0,
    durationSec: DEFAULT_LAYER_DURATION,
    zIndex: index,
  }, index);
}

export function VideoLayersPanel({ layers, onChange }: { layers: VideoEditorLayer[]; onChange: (layers: VideoEditorLayer[]) => void }) {
  const mapObjectsFn = useServerFn(mapVideoObjects);
  const [selectedId, setSelectedId] = useState(layers[0]?.id ?? null);
  const [playhead, setPlayhead] = useState(0);
  const [visionBusy, setVisionBusy] = useState(false);
  const [visionLayerId, setVisionLayerId] = useState<string | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);
  const [visionObjects, setVisionObjects] = useState<VisionObject[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pointers, setPointers] = useState<Map<number, { x: number; y: number }>>(new Map());
  const dragState = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const pinchState = useRef<{ id: string; distance: number; scale: number; midX: number; midY: number; originX: number; originY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const normalizedLayers = useMemo(() => layers.map(normalizeLayer), [layers]);
  const selected = normalizedLayers.find((layer) => layer.id === selectedId) ?? null;
  const totalDuration = Math.max(1, ...normalizedLayers.map((layer) => (layer.startSec ?? 0) + (layer.durationSec ?? DEFAULT_LAYER_DURATION)));

  useEffect(() => {
    if (selectedId && !normalizedLayers.some((layer) => layer.id === selectedId)) setSelectedId(normalizedLayers[0]?.id ?? null);
  }, [normalizedLayers, selectedId]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => setPlayhead((current) => current >= totalDuration ? 0 : Math.min(totalDuration, current + 0.05)), 50);
    return () => window.clearInterval(timer);
  }, [isPlaying, totalDuration]);

  function commit(next: VideoEditorLayer[]) { onChange(next.map(normalizeLayer)); }
  function patch(id: string, value: Partial<VideoEditorLayer>) { commit(normalizedLayers.map((layer) => layer.id === id ? { ...layer, ...value } : layer)); }
  function add(type: VideoEditorLayer["type"], content = "") { const layer = makeLayer(type, normalizedLayers.length + 1, content); commit([...normalizedLayers, layer]); setSelectedId(layer.id); }
  function remove(id: string) { commit(normalizedLayers.filter((layer) => layer.id !== id)); if (selectedId === id) setSelectedId(normalizedLayers.find((layer) => layer.id !== id)?.id ?? null); }
  function move(id: string, direction: -1 | 1) { const index = normalizedLayers.findIndex((layer) => layer.id === id); const target = index + direction; if (index < 0 || target < 0 || target >= normalizedLayers.length) return; const next = [...normalizedLayers]; [next[index], next[target]] = [next[target], next[index]]; commit(next.map((layer, i) => ({ ...layer, zIndex: i }))); }

  function addFile(file: File) {
    const url = URL.createObjectURL(file);
    const type: VideoEditorLayer["type"] = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : "overlay";
    const layer = makeLayer(type, normalizedLayers.length + 1, url);
    layer.name = file.name;
    layer.sourceKind = "file";
    commit([...normalizedLayers, layer]);
    setSelectedId(layer.id);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) return addFile(file);
    const url = event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain");
    if (!/^https?:\/\//i.test(url)) return;
    const type: VideoEditorLayer["type"] = /\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : "image";
    const layer = makeLayer(type, normalizedLayers.length + 1, url);
    layer.name = type === "video" ? "Dropped video" : "Dropped image";
    commit([...normalizedLayers, layer]);
    setSelectedId(layer.id);
  }

  function canvasPoint(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * CANVAS_W - CANVAS_W / 2, y: ((event.clientY - rect.top) / rect.height) * CANVAS_H - CANVAS_H / 2 };
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>, layer: VideoEditorLayer) {
    if (layer.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = canvasPoint(event);
    setPointers((current) => new Map(current).set(event.pointerId, { x: event.clientX, y: event.clientY }));
    dragState.current = { id: layer.id, startX: point.x, startY: point.y, originX: layer.x, originY: layer.y };
    setSelectedId(layer.id);
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const currentPointers = new Map(pointers);
    if (!currentPointers.has(event.pointerId)) return;
    currentPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setPointers(currentPointers);
    const layer = normalizedLayers.find((item) => item.id === selectedId);
    if (!layer || layer.locked) return;
    if (currentPointers.size >= 2) {
      const [a, b] = [...currentPointers.values()];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const midX = (a.x + b.x) / 2; const midY = (a.y + b.y) / 2;
      if (!pinchState.current) pinchState.current = { id: layer.id, distance, scale: layer.scale, midX, midY, originX: layer.x, originY: layer.y };
      const p = pinchState.current;
      const ratio = p.distance > 0 ? distance / p.distance : 1;
      patch(layer.id, { scale: Math.max(0.05, Math.min(5, p.scale * ratio)), x: p.originX + midX - p.midX, y: p.originY + midY - p.midY });
      return;
    }
    if (!dragState.current || dragState.current.id !== layer.id) return;
    const point = canvasPoint(event);
    patch(layer.id, { x: dragState.current.originX + point.x - dragState.current.startX, y: dragState.current.originY + point.y - dragState.current.startY });
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    setPointers((current) => { const next = new Map(current); next.delete(event.pointerId); if (next.size < 2) pinchState.current = null; if (!next.size) dragState.current = null; return next; });
  }

  function timelineDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/x-aurora-layer");
    if (!id || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    patch(id, { startSec: Number((ratio * totalDuration).toFixed(2)) });
  }

  async function runVision(layer: VideoEditorLayer) {
    if (!layer.content || !/^https?:\/\//i.test(layer.content)) { setVisionError("Vision mapping needs a hosted image or video thumbnail. Studio assets work immediately."); return; }
    setVisionBusy(true); setVisionLayerId(layer.id); setVisionError(null);
    try { const result = await mapObjectsFn({ data: { imageUrl: layer.content } }); setVisionObjects(result.objects); patch(layer.id, { visionObjects: result.objects }); }
    catch (error) { setVisionError(error instanceof Error ? error.message : "Vision mapping failed"); setVisionObjects([]); }
    finally { setVisionBusy(false); setVisionLayerId(null); }
  }

  const activeLayers = normalizedLayers.filter((layer) => layer.visible && playhead >= (layer.startSec ?? 0) && playhead <= (layer.startSec ?? 0) + (layer.durationSec ?? DEFAULT_LAYER_DURATION)).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider">Composite Video Layers</p><p className="mt-0.5 text-[10px] text-muted-foreground">Every video, image and emoji is a time-based layer. Drag on canvas, pinch to scale, and place layers on the timeline.</p></div>
        <div className="flex items-center gap-1.5"><Button size="sm" variant="ghost" onClick={() => add("overlay", "✨")}>✨</Button><Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}><Plus className="size-3.5" /> Media</Button><input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) addFile(file); e.currentTarget.value = ""; }} /></div>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="relative mx-auto aspect-video max-h-[520px] w-full overflow-hidden rounded-xl border border-border bg-black touch-none select-none" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.15) 1px, transparent 1px)", backgroundSize: "10% 10%" }} />
            {activeLayers.map((layer) => {
              const style: CSSProperties = { left: `calc(50% + ${(layer.x / CANVAS_W) * 100}%)`, top: `calc(50% + ${(layer.y / CANVAS_H) * 100}%)`, transform: `translate(-50%, -50%) scale(${layer.scale}) rotate(${layer.rotation ?? 0}deg)`, opacity: layer.opacity, zIndex: layer.zIndex ?? 0 };
              return <div key={layer.id} className={cn("absolute max-w-[90%] cursor-move rounded border-2 border-transparent p-1", selectedId === layer.id && "border-primary")} style={style} onPointerDown={(event) => pointerDown(event, layer)}>
                {layer.type === "video" && layer.content ? <video src={layer.content} muted playsInline autoPlay loop className="max-h-[70vh] max-w-[70vw] rounded object-contain" /> : null}
                {layer.type === "image" && layer.content ? <img src={layer.content} alt={layer.name} className="max-h-[70vh] max-w-[70vw] rounded object-contain" /> : null}
                {(layer.type === "overlay" || layer.type === "text") && <span className="whitespace-pre-wrap text-5xl font-semibold text-white drop-shadow-[0_3px_10px_rgba(0,0,0,.7)]">{layer.content || "✨"}</span>}
                {layer.type === "audio" && <Music2 className="size-10 text-primary" />}
              </div>;
            })}
            {!activeLayers.length && <div className="absolute inset-0 flex items-center justify-center text-xs text-white/50">Drop a video, picture or emoji here</div>}
            {visionObjects.map((object, index) => <div key={`${object.label}-${index}`} className="pointer-events-none absolute border border-cyan-300/80" style={{ left: `${object.x * 100}%`, top: `${object.y * 100}%`, width: `${object.width * 100}%`, height: `${object.height * 100}%` }}><span className="absolute -top-5 left-0 rounded bg-cyan-300 px-1 text-[9px] font-semibold text-black">{object.label}</span></div>)}
          </div>

          <div className="mt-3 rounded-lg border border-border bg-background/60 p-2">
            <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground"><button className="rounded px-2 py-1 hover:bg-muted" onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? "Pause" : "Play"}</button><span>{playhead.toFixed(2)}s / {totalDuration.toFixed(2)}s</span></div>
            <div ref={timelineRef} className="relative h-24 overflow-x-auto rounded bg-black/30 p-1" onDragOver={(event) => event.preventDefault()} onDrop={timelineDrop}>
              <div className="relative h-full min-w-[720px]" style={{ width: `${Math.max(100, totalDuration * 120)}px` }}>
                {normalizedLayers.map((layer) => { const left = ((layer.startSec ?? 0) / totalDuration) * 100; const width = ((layer.durationSec ?? DEFAULT_LAYER_DURATION) / totalDuration) * 100; return <button key={layer.id} className={cn("absolute h-7 rounded border px-2 text-left text-[9px] font-semibold truncate", selectedId === layer.id ? "border-primary bg-primary/20 text-primary" : "border-border bg-muted/60 text-muted-foreground")} style={{ left: `${left}%`, width: `${Math.max(5, width)}%`, top: `${(layer.zIndex ?? 0) * 30}px` }} draggable onDragStart={(event) => event.dataTransfer.setData("application/x-aurora-layer", layer.id)} onClick={() => setSelectedId(layer.id)} title="Drag this layer to a new time position">{layer.name}</button>; })}
                <div className="pointer-events-none absolute top-0 h-full w-px bg-primary" style={{ left: `${(playhead / totalDuration) * 100}%` }} />
                <input aria-label="Timeline playhead" type="range" min={0} max={totalDuration} step={0.01} value={playhead} onChange={(event) => setPlayhead(Number(event.target.value))} className="absolute inset-x-0 bottom-0 w-full opacity-0" />
              </div>
            </div>
            <p className="mt-1 text-[9px] text-muted-foreground">Drag a layer bar onto the timeline. Start + Duration remain editable in the inspector.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-background/50 p-3"><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Layer stack</p><span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] text-primary">{normalizedLayers.length}</span></div><div className="space-y-1.5">{[...normalizedLayers].reverse().map((layer) => { const Icon = ICONS[layer.type]; return <div key={layer.id} className={cn("flex items-center gap-1.5 rounded-lg border px-2 py-1.5", selectedId === layer.id ? "border-primary/50 bg-primary/5" : "border-transparent")}><GripVertical className="size-3 text-muted-foreground" /><button className="min-w-0 flex-1 truncate text-left text-[10px] font-medium" onClick={() => setSelectedId(layer.id)}><Icon className="mr-1 inline size-3" />{layer.name}</button><button onClick={() => patch(layer.id, { visible: !layer.visible })} className="rounded p-1 text-muted-foreground">{layer.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}</button><button onClick={() => patch(layer.id, { locked: !layer.locked })} className="rounded p-1 text-muted-foreground">{layer.locked ? <Lock className="size-3" /> : <LockOpen className="size-3" />}</button><button onClick={() => remove(layer.id)} className="rounded p-1 text-muted-foreground hover:text-rose-400"><Trash2 className="size-3" /></button></div>; })}</div></div>

          <div className="rounded-lg border border-dashed border-border p-3 text-center" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}><Move className="mx-auto mb-1.5 size-4 text-primary" /><p className="text-[10px] font-semibold">Drag & drop media</p><p className="mt-0.5 text-[9px] text-muted-foreground">Images, videos and files become independent layers.</p></div>

          {selected && <div className="space-y-3 rounded-lg border border-border p-3"><div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Inspector</p><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => move(selected.id, -1)}>↑</Button><Button size="sm" variant="ghost" onClick={() => move(selected.id, 1)}>↓</Button></div></div><input value={selected.name} disabled={selected.locked} onChange={(e) => patch(selected.id, { name: e.target.value })} className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs" />{(selected.type === "video" || selected.type === "image" || selected.type === "overlay") && <input value={selected.content ?? ""} disabled={selected.locked} onChange={(e) => patch(selected.id, { content: e.target.value, sourceKind: "url" })} className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs" placeholder="Media URL / emoji" />}{selected.type === "text" && <textarea value={selected.content ?? ""} disabled={selected.locked} onChange={(e) => patch(selected.id, { content: e.target.value })} className="min-h-16 w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-xs" placeholder="Text content" />}<div className="grid grid-cols-2 gap-2">{[["x", selected.x, -360, 360], ["y", selected.y, -202, 202], ["scale", selected.scale, 0.05, 5], ["opacity", selected.opacity, 0, 1], ["startSec", selected.startSec ?? 0, 0, Math.max(120, totalDuration)], ["durationSec", selected.durationSec ?? DEFAULT_LAYER_DURATION, 0.1, 120], ["rotation", selected.rotation ?? 0, -180, 180]].map(([key, value, min, max]) => <label key={key as string} className="text-[9px] text-muted-foreground">{key}<input type="range" min={min as number} max={max as number} step={key === "opacity" || key === "scale" ? 0.05 : 0.1} value={value as number} disabled={selected.locked} onChange={(e) => patch(selected.id, { [key as string]: Number(e.target.value) })} className="mt-1 w-full accent-primary" /></label>)}</div><Button size="sm" variant="outline" className="w-full gap-1.5" disabled={visionBusy || !selected.content || !/^https?:\/\//i.test(selected.content)} onClick={() => void runVision(selected)}><ScanSearch className="size-3.5" />{visionBusy && visionLayerId === selected.id ? "Mapping objects…" : "Vision: map objects"}</Button>{visionError && <p className="text-[9px] leading-relaxed text-amber-400">{visionError}</p>}{visionObjects.length > 0 && <div className="space-y-1 rounded-md bg-muted/30 p-2"><p className="text-[9px] font-semibold text-muted-foreground">Detected objects</p>{visionObjects.map((object, index) => <p key={`${object.label}-${index}`} className="text-[9px] text-foreground">{object.label} · {Math.round(object.x * 100)}%, {Math.round(object.y * 100)}% · {Math.round(object.width * 100)}×{Math.round(object.height * 100)}%</p>)}</div>}</div>}
        </div>
      </div>
    </section>
  );
}
