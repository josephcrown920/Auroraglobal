import { createLazyFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Eye, EyeOff, ImagePlus, Layers3, Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/use-auth";
import { AuthRedirect } from "@/components/AuthRedirect";
import { PageSpinner } from "@/components/PageSpinner";
import { UploadSlot } from "@/components/studio/UploadSlot";
import { layerizeImage, type AuroraLayer, type LayerProvider } from "@/lib/layers.functions";
import { cn } from "@/lib/utils";

export const Route = createLazyFileRoute("/layers")({ component: LayersPage });

type LayerState = AuroraLayer & { visible: boolean; opacity: number; x: number; y: number; scale: number };

function toLayerState(layer: AuroraLayer): LayerState {
  const normalized = layer.boundingBox?.normalized ?? [0, 0, 1000, 1000];
  const [left] = normalized;
  return { ...layer, visible: true, opacity: 1, x: left, y: normalized[1], scale: 1 };
}

function LayerThumbnail({ layer, selected, onClick }: { layer: LayerState; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("group flex w-full items-center gap-3 rounded-xl border p-2 text-left transition", selected ? "border-primary/60 bg-primary/10" : "border-border bg-card/40 hover:bg-card", !layer.visible && "opacity-50")}>
      <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-border bg-[linear-gradient(45deg,#222_25%,transparent_25%,transparent_75%,#222_75%),linear-gradient(45deg,#222_25%,transparent_25%,transparent_75%,#222_75%)] bg-[length:12px_12px] bg-[position:0_0,6px_6px]"><img src={layer.url} alt="" className="h-full w-full object-contain" /></div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{layer.name}</p><p className="truncate text-[11px] text-muted-foreground">{layer.description || `Layer ${layer.zIndex}`}</p></div>
      {layer.visible ? <Eye className="size-4 text-muted-foreground" /> : <EyeOff className="size-4 text-muted-foreground" />}
    </button>
  );
}

function LayersPage() {
  const { session, loading } = useAuth();
  const layerize = useServerFn(layerizeImage);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [pastedUrl, setPastedUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<LayerProvider>("auto");
  const [size, setSize] = useState<"auto" | "1K" | "1.5K" | "2K">("auto");
  const [layers, setLayers] = useState<LayerState[]>([]);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [engine, setEngine] = useState("");

  useEffect(() => {
    const image = new URLSearchParams(window.location.search).get("image");
    if (image) {
      setSourceUrl(image);
      setPastedUrl("");
      setBaseUrl(image);
      window.history.replaceState({}, "", "/layers");
    }
  }, []);

  const selected = useMemo(() => layers.find((layer) => layer.id === selectedId) ?? null, [layers, selectedId]);

  if (loading) return <PageSpinner />;
  if (!session) return <AuthRedirect />;

  const updateLayer = (id: string, patch: Partial<LayerState>) => setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));

  const resetLayer = (id: string) => {
    const layer = layers.find((item) => item.id === id);
    if (!layer) return;
    const [left, top] = layer.boundingBox?.normalized ?? [0, 0];
    updateLayer(id, { x: left, y: top, scale: 1, opacity: 1, visible: true });
  };

  const moveLayer = (id: string, direction: "up" | "down") => {
    setLayers((current) => {
      const index = current.findIndex((layer) => layer.id === id);
      if (index < 0) return current;
      const target = direction === "up" ? index + 1 : index - 1;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const run = async () => {
    const imageUrl = sourceUrl || pastedUrl.trim();
    if (!imageUrl) { toast.error("Upload an image or paste an image URL first"); return; }
    setRunning(true);
    try {
      const result = await layerize({ data: { imageUrl, prompt, provider, size } });
      setBaseUrl(result.baseUrl);
      const next = result.layers.map(toLayerState);
      setLayers(next);
      setSelectedId(next[0]?.id ?? null);
      setEngine(result.layerizer);
      toast.success(`${next.length} editable layers created`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Layer separation failed");
    } finally { setRunning(false); }
  };

  const clear = () => { setSourceUrl(null); setPastedUrl(""); setBaseUrl(null); setLayers([]); setSelectedId(null); setEngine(""); };
  const previewLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-10">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary"><Layers3 className="size-4" /> Aurora Layers</div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Turn any image into editable layers.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">Generate with Nano Banana, GPT Image, Seedream, Flux, ComfyUI or anything else — then send the finished image here. Layer separation is a separate post-processing tool, so the source image model does not matter.</p>
          </div>
          {layers.length > 0 && <Button variant="outline" onClick={clear} className="shrink-0"><Trash2 className="mr-2 size-4" /> Start over</Button>}
        </header>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_340px]">
          <section className="rounded-2xl border border-border bg-card/40 p-4 md:p-5">
            <div className="mb-5"><p className="text-sm font-semibold">1. Source image</p><p className="mt-1 text-xs text-muted-foreground">Upload a finished Aurora image, a ComfyUI result, or any supported image.</p></div>
            <UploadSlot userId={session.user.id} label="Image" hint="Upload JPG, PNG or WebP" value={sourceUrl} onChange={(url) => { setSourceUrl(url); if (url) setPastedUrl(""); }} />
            <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground"><span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" /></div>
            <Input value={pastedUrl} onChange={(event) => { setPastedUrl(event.target.value); if (event.target.value) setSourceUrl(null); }} placeholder="Paste image URL" />
            <div className="mt-5 space-y-4">
              <div><label className="mb-2 block text-xs font-medium">Layerizer</label><Select value={provider} onValueChange={(value) => setProvider(value as LayerProvider)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto — Aurora</SelectItem><SelectItem value="modelark">Seedream 5 Pro — ModelArk</SelectItem><SelectItem value="fal-seedream">Seedream 5 Pro — fal.ai</SelectItem><SelectItem value="fal-qwen">Qwen Image Layered — fal.ai</SelectItem></SelectContent></Select><p className="mt-1 text-[11px] text-muted-foreground">This is the separation engine, not the model that created the image.</p></div>
              <div><label className="mb-2 block text-xs font-medium">Resolution</label><Select value={size} onValueChange={(value) => setSize(value as typeof size)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto</SelectItem><SelectItem value="1K">1K</SelectItem><SelectItem value="1.5K">1.5K</SelectItem><SelectItem value="2K">2K</SelectItem></SelectContent></Select></div>
              <div><label className="mb-2 block text-xs font-medium">What should be separated? <span className="font-normal text-muted-foreground">optional</span></label><Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={4} placeholder="Leave empty for automatic major-element detection. Or: person, car, background, headline text, logo." /></div>
              <Button className="w-full" size="lg" onClick={run} disabled={running || !(sourceUrl || pastedUrl.trim())}>{running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}{running ? "Separating layers…" : "Separate into layers"}</Button>
            </div>
          </section>

          <section className="min-h-[600px] rounded-2xl border border-border bg-card/20 p-3 md:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">2. Layer canvas</p><p className="text-xs text-muted-foreground">Toggle, reorder, move and scale each extracted element without regenerating the whole image.</p></div>{engine && <span className="hidden rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground md:block">{engine}</span>}</div>
            <div className="relative mx-auto aspect-square max-h-[760px] w-full max-w-[760px] overflow-hidden rounded-2xl border border-border bg-black/20">
              {baseUrl ? <img src={baseUrl} alt="Layered base" className="absolute inset-0 h-full w-full object-contain" /> : <div className="absolute inset-0 grid place-items-center p-8 text-center text-muted-foreground"><div><ImagePlus className="mx-auto mb-3 size-10 opacity-40" /><p className="text-sm">Your editable composition will appear here.</p></div></div>}
              {baseUrl && previewLayers.map((layer) => {
                if (!layer.visible) return null;
                const box = layer.boundingBox?.normalized ?? [0, 0, 1000, 1000];
                const width = Math.max(1, box[2] - box[0]);
                const height = Math.max(1, box[3] - box[1]);
                return <img key={layer.id} src={layer.url} alt={layer.name} onClick={() => setSelectedId(layer.id)} className={cn("absolute cursor-pointer object-contain transition", selectedId === layer.id && "outline outline-2 outline-primary")} style={{ left: `${layer.x / 10}%`, top: `${layer.y / 10}%`, width: `${(width * layer.scale) / 10}%`, height: `${(height * layer.scale) / 10}%`, opacity: layer.opacity, zIndex: layer.zIndex + 10 }} />;
              })}
            </div>
          </section>

          <aside className="rounded-2xl border border-border bg-card/40 p-4 md:p-5">
            <div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">3. Editable stack</p><p className="text-xs text-muted-foreground">{layers.length ? `${layers.length} transparent layers` : "Waiting for separation"}</p></div>{layers.length > 0 && <Layers3 className="size-5 text-primary" />}</div>
            <div className="space-y-2">{layers.length === 0 && <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Separate an image to populate the layer stack.</div>}{layers.map((layer) => <LayerThumbnail key={layer.id} layer={layer} selected={layer.id === selectedId} onClick={() => setSelectedId(layer.id)} />)}</div>
            {selected && <div className="mt-5 space-y-4 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{selected.name}</p><p className="text-[11px] text-muted-foreground">Z-index {selected.zIndex}</p></div><button type="button" onClick={() => updateLayer(selected.id, { visible: !selected.visible })} className="rounded-lg border border-border p-2" aria-label="Toggle layer visibility">{selected.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}</button></div>
              <div><div className="mb-2 flex justify-between text-[11px] text-muted-foreground"><span>Opacity</span><span>{Math.round(selected.opacity * 100)}%</span></div><Slider value={[selected.opacity * 100]} min={0} max={100} step={1} onValueChange={([value]) => updateLayer(selected.id, { opacity: value / 100 })} /></div>
              <div><div className="mb-2 flex justify-between text-[11px] text-muted-foreground"><span>Horizontal position</span><span>{Math.round(selected.x / 10)}%</span></div><Slider value={[selected.x]} min={0} max={1000} step={1} onValueChange={([value]) => updateLayer(selected.id, { x: value })} /></div>
              <div><div className="mb-2 flex justify-between text-[11px] text-muted-foreground"><span>Vertical position</span><span>{Math.round(selected.y / 10)}%</span></div><Slider value={[selected.y]} min={0} max={1000} step={1} onValueChange={([value]) => updateLayer(selected.id, { y: value })} /></div>
              <div><div className="mb-2 flex justify-between text-[11px] text-muted-foreground"><span>Scale</span><span>{selected.scale.toFixed(2)}×</span></div><Slider value={[selected.scale * 100]} min={25} max={300} step={1} onValueChange={([value]) => updateLayer(selected.id, { scale: value / 100 })} /></div>
              <div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={() => moveLayer(selected.id, "down")}><ArrowDown className="mr-1 size-3" /> Back</Button><Button variant="outline" size="sm" onClick={() => moveLayer(selected.id, "up")}><ArrowUp className="mr-1 size-3" /> Front</Button><Button variant="outline" size="sm" onClick={() => resetLayer(selected.id)}><RotateCcw className="mr-1 size-3" /> Reset</Button><Button variant="outline" size="sm" asChild><a href={selected.url} download><Download className="mr-1 size-3" /> PNG</a></Button></div>
            </div>}
          </aside>
        </div>
      </div>
    </main>
  );
}
