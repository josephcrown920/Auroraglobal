import { useMemo, useState } from "react";
import { Eye, EyeOff, GripVertical, Image as ImageIcon, Lock, LockOpen, Music2, Plus, Trash2, Type, Video, Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  content?: string;
};

const ICONS = { video: Video, image: ImageIcon, text: Type, audio: Music2, overlay: Layers3 };

function makeLayer(type: VideoEditorLayer["type"], index: number): VideoEditorLayer {
  return {
    id: crypto.randomUUID(),
    type,
    name: type === "text" ? \`Text ${index}\` : \`${type[0].toUpperCase()}${type.slice(1)} ${index}\`,
    visible: true,
    locked: false,
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    content: type === "text" ? "Your text" : "",
  };
}

export function VideoLayersPanel({
  layers,
  onChange,
}: {
  layers: VideoEditorLayer[];
  onChange: (layers: VideoEditorLayer[]) => void;
}) {
  const [selectedId, setSelectedId] = useState(layers[0]?.id ?? null);
  const selected = layers.find((layer) => layer.id === selectedId) ?? null;
  const nextIndex = useMemo(() => layers.length + 1, [layers.length]);

  function add(type: VideoEditorLayer["type"]) {
    const layer = makeLayer(type, nextIndex);
    onChange([...layers, layer]);
    setSelectedId(layer.id);
  }

  function patch(id: string, patch: Partial<VideoEditorLayer>) {
    onChange(layers.map((layer) => layer.id === id ? { ...layer, ...patch } : layer));
  }

  function remove(id: string) {
    onChange(layers.filter((layer) => layer.id !== id));
    if (selectedId === id) setSelectedId(layers.find((layer) => layer.id !== id)?.id ?? null);
  }

  function move(id: string, direction: -1 | 1) {
    const index = layers.findIndex((layer) => layer.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= layers.length) return;
    const next = [...layers];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider">Layers</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Stack video, images, text, audio and overlays.</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">{layers.length}</span>
      </div>

      <div className="grid grid-cols-5 gap-1 border-b border-border p-2">
        {(Object.keys(ICONS) as VideoEditorLayer["type"][]).map((type) => {
          const Icon = ICONS[type];
          return (
            <button key={type} onClick={() => add(type)} className="flex flex-col items-center gap-1 rounded-lg border border-border px-1 py-2 text-[9px] text-muted-foreground hover:border-primary/40 hover:text-primary" title={\`Add ${type} layer\`}>
              <Icon className="size-3.5" />
              {type}
            </button>
          );
        })}
      </div>

      <div className="max-h-56 overflow-y-auto p-2">
        {layers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-muted-foreground">
            <Plus className="mx-auto mb-2 size-4" />
            Add your first layer.
          </div>
        ) : (
          [...layers].reverse().map((layer) => {
            const Icon = ICONS[layer.type];
            return (
              <div key={layer.id} className={cn("mb-1 flex items-center gap-2 rounded-lg border px-2 py-2", selectedId === layer.id ? "border-primary/50 bg-primary/5" : "border-transparent hover:border-border")}>
                <GripVertical className="size-3 shrink-0 text-muted-foreground" />
                <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(layer.id)}>
                  <span className="flex items-center gap-1.5 text-xs font-medium"><Icon className="size-3.5" />{layer.name}</span>
                </button>
                <button onClick={() => patch(layer.id, { visible: !layer.visible })} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Toggle visibility">
                  {layer.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
                <button onClick={() => patch(layer.id, { locked: !layer.locked })} className="rounded p-1 text-muted-foreground hover:text-foreground" title="Toggle lock">
                  {layer.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
                </button>
                <button onClick={() => remove(layer.id)} className="rounded p-1 text-muted-foreground hover:text-rose-400" title="Delete layer">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <div className="border-t border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Inspector</p>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => move(selected.id, -1)}>↑</Button>
              <Button size="sm" variant="ghost" onClick={() => move(selected.id, 1)}>↓</Button>
            </div>
          </div>
          <input value={selected.name} disabled={selected.locked} onChange={(e) => patch(selected.id, { name: e.target.value })} className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs" />
          {selected.type === "text" && (
            <textarea value={selected.content ?? ""} disabled={selected.locked} onChange={(e) => patch(selected.id, { content: e.target.value })} className="min-h-16 w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-xs" placeholder="Text content" />
          )}
          {(selected.type === "video" || selected.type === "image" || selected.type === "overlay") && (
            <input value={selected.content ?? ""} disabled={selected.locked} onChange={(e) => patch(selected.id, { content: e.target.value })} className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs" placeholder="Media URL (optional)" />
          )}
          <div className="grid grid-cols-2 gap-2">
            {[["x", selected.x, -100, 100], ["y", selected.y, -100, 100], ["scale", selected.scale, 0.1, 4], ["opacity", selected.opacity, 0, 1]].map(([key, value, min, max]) => (
              <label key={key as string} className="text-[10px] text-muted-foreground">
                {key}
                <input type="range" min={min as number} max={max as number} step={key === "opacity" || key === "scale" ? 0.05 : 1} value={value as number} disabled={selected.locked} onChange={(e) => patch(selected.id, { [key as string]: Number(e.target.value) })} className="mt-1 w-full accent-primary" />
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
