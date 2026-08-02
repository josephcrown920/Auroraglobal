import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  ArrowLeft,
  Camera,
  Check,
  Download,
  ImagePlus,
  Loader2,
  Rotate3d,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { extractScene } from "@/lib/extract-scene.functions";
import { generateAngle } from "@/lib/generate-angle.functions";
import { upscaleScene } from "@/lib/upscale-scene.functions";
import { sceneChat } from "@/lib/scene-chat.functions";
import { suggestGrade } from "@/lib/suggest-grade.functions";
import { BeforeAfter } from "@/components/scene/BeforeAfter";
import { AssistantPanel, type ChatMsg } from "@/components/scene/AssistantPanel";
import { ColorPanel } from "@/components/scene/ColorPanel";
import { FlowsPanel } from "@/components/scene/FlowsPanel";
import { GalleryPanel } from "@/components/scene/GalleryPanel";
import { Minimap3D } from "@/components/scene/Minimap3D";
import { MultiAngleNodeBoard, type AngleNode } from "@/components/scene/MultiAngleNode";
import { RebuildPanel } from "@/components/scene/RebuildPanel";
import { StoryboardPanel } from "@/components/scene/StoryboardPanel";
import { TimelinePanel } from "@/components/scene/TimelinePanel";
import type { Clip, GalleryEntry, Grade, Shot } from "@/lib/scene-weaver-types";
import { NEUTRAL_GRADE, PRESETS, presetByKey } from "@/lib/scene-weaver-grade";

export const Route = createLazyFileRoute("/scene-weaver")({ component: SceneWeaverPage });

type SceneItem = {
  id: string;
  name: string;
  original: string;
  result: string | null;
  previous: string | null;
  status: "queued" | "processing" | "done" | "error";
  error?: string;
  chat: ChatMsg[];
  variants: { id: string; label: string; src: string }[];
  nodes: AngleNode[];
  busy: boolean;
  angleBusy: boolean;
  upscaleBusy: boolean;
  grade: Grade;
  gradePreset?: string;
  gradeNote?: string;
  grading?: boolean;
};
type StudioView = "create" | "gallery" | "color" | "board" | "timeline" | "flows";

const ANGLES = [
  ["Left 30°", "Rotate the camera 30 degrees to the left, same subject distance."],
  ["Right 30°", "Rotate the camera 30 degrees to the right, same subject distance."],
  ["Reverse 180°", "Show the same scene from 180 degrees behind the original camera."],
  ["Low angle", "Lower the camera to a cinematic low angle, preserving the scene."],
];

function makeNodes(): AngleNode[] {
  return ANGLES.map(([label, prompt], index) => ({
    id: `angle-${index}`,
    label,
    prompt,
    enabled: index < 2,
    state: "idle",
  }));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function safeName(value: string) {
  return (value || "scene").replace(/[^\w.-]+/g, "_").slice(0, 80) || "scene";
}

function SceneWeaverPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const extractFn = useServerFn(extractScene);
  const angleFn = useServerFn(generateAngle);
  const upscaleFn = useServerFn(upscaleScene);
  const chatFn = useServerFn(sceneChat);
  const [items, setItems] = useState<SceneItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [customAngle, setCustomAngle] = useState("");
  const [showMap, setShowMap] = useState(true);
  const [view, setView] = useState<StudioView>("create");
  const [shots, setShots] = useState<Shot[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const suggestFn = useServerFn(suggestGrade);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const active = items.find((item) => item.id === activeId) ?? null;
  const gallery: GalleryEntry[] = items.flatMap((item) => [
    {
      id: `${item.id}-source`,
      itemId: item.id,
      itemName: item.name,
      kind: "source" as const,
      label: "Original frame",
      src: item.original,
      grade: { ...NEUTRAL_GRADE },
    },
    ...(item.result
      ? [{
          id: `${item.id}-plate`,
          itemId: item.id,
          itemName: item.name,
          kind: "plate" as const,
          label: "Clean plate",
          src: item.result,
          grade: { ...NEUTRAL_GRADE },
        }]
      : []),
    ...item.variants.map((variant) => ({
      id: variant.id,
      itemId: item.id,
      itemName: item.name,
      kind: "angle" as const,
      label: variant.label,
      src: variant.src,
      grade: { ...NEUTRAL_GRADE },
    })),
  ]);
  const update = useCallback((id: string, patch: Partial<SceneItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const processItem = useCallback(
    async (item: SceneItem, instruction?: string) => {
      update(item.id, { status: "processing", error: undefined });
      try {
        const output = await extractFn({
          data: {
            imageDataUrl: item.original,
            ...(instruction ? { instruction } : {}),
          },
        });
        setItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, status: "done", previous: candidate.result, result: output.imageDataUrl }
              : candidate,
          ),
        );
      } catch (error) {
        update(item.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Scene extraction failed",
        });
      }
    },
    [extractFn, update],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const valid = Array.from(files).filter((file) => file.type.startsWith("image/") && file.size <= 8 * 1024 * 1024);
      if (!valid.length) {
        toast.error("Choose image files up to 8 MB each.");
        return;
      }
      const next = await Promise.all(
        valid.map(async (file) => ({
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^.]+$/, ""),
          original: await fileToDataUrl(file),
          result: null,
          previous: null,
          status: "queued" as const,
          chat: [],
          variants: [],
          nodes: makeNodes(),
          busy: false,
          angleBusy: false,
          upscaleBusy: false,
          grade: { ...NEUTRAL_GRADE },
          gradePreset: "neutral",
        })),
      );
      setItems((current) => [...current, ...next]);
      setActiveId((current) => current ?? next[0]?.id ?? null);
      for (const item of next) await processItem(item);
    },
    [processItem],
  );

  const rebuild = async (instruction?: string) => {
    if (!active) return;
    await processItem(active, instruction);
  };

  const runAngle = async (nodeId: string, prompt: string, label: string) => {
    if (!active?.result) return;
    update(active.id, {
      angleBusy: true,
      nodes: active.nodes.map((node) => (node.id === nodeId ? { ...node, state: "running" } : node)),
    });
    try {
      const output = await angleFn({ data: { imageDataUrl: active.result, angle: prompt } });
      setItems((current) =>
        current.map((item) =>
          item.id === active.id
            ? {
                ...item,
                angleBusy: false,
                variants: [...item.variants, { id: crypto.randomUUID(), label, src: output.imageDataUrl }],
                nodes: item.nodes.map((node) => (node.id === nodeId ? { ...node, state: "done" } : node)),
              }
            : item,
        ),
      );
      toast.success(`${label} angle ready`);
    } catch (error) {
      update(active.id, {
        angleBusy: false,
        nodes: active.nodes.map((node) => (node.id === nodeId ? { ...node, state: "error" } : node)),
      });
      toast.error(error instanceof Error ? error.message : "Angle generation failed");
    }
  };

  const runSelectedAngles = async () => {
    if (!active) return;
    setBatchBusy(true);
    try {
      for (const node of active.nodes.filter((candidate) => candidate.enabled)) {
        await runAngle(node.id, node.prompt, node.label);
      }
    } finally {
      setBatchBusy(false);
    }
  };

  const upscale = async (factor: "2x" | "4x") => {
    if (!active?.result) return;
    update(active.id, { upscaleBusy: true });
    try {
      const output = await upscaleFn({ data: { imageDataUrl: active.result, factor } });
      update(active.id, { upscaleBusy: false, previous: active.result, result: output.imageDataUrl });
      toast.success(`Upscaled ${factor}`);
    } catch (error) {
      update(active.id, { upscaleBusy: false });
      toast.error(error instanceof Error ? error.message : "Upscale failed");
    }
  };

  const sendChat = async (text: string) => {
    if (!active) return;
    const messages = [...active.chat, { role: "user" as const, content: text }];
    update(active.id, { chat: messages });
    try {
      const response = await chatFn({
        data: {
          messages: messages.map(({ role, content }) => ({ role, content })),
          sceneName: active.name,
          hasResult: !!active.result,
          variantCount: active.variants.length,
        },
      });
      update(active.id, {
        chat: [...messages, { role: "assistant", content: response.reply, action: response.action }],
      });
      if (response.action === "refine" || response.action === "rebuild") await rebuild(response.instruction || undefined);
      if (response.action === "angle" && response.instruction) await runAngle("assistant-angle", response.instruction, "Assistant angle");
      if (response.action === "upscale") await upscale("2x");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assistant failed");
    }
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const move = <T extends { id: string }>(list: T[], id: string, direction: -1 | 1) => {
    const index = list.findIndex((item) => item.id === id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= list.length) return list;
    const copy = [...list];
    [copy[index], copy[next]] = [copy[next], copy[index]];
    return copy;
  };

  const addShot = (entry: GalleryEntry) => {
    setShots((current) => [...current, {
      id: crypto.randomUUID(),
      src: entry.src,
      name: `${entry.itemName} — ${entry.label}`,
      caption: "",
      shotType: entry.kind === "angle" ? "Wide" : "Establishing",
      selected: true,
      grade: entry.grade,
    }]);
    toast.success("Added to storyboard");
  };

  const addClip = (entry: GalleryEntry) => {
    setClips((current) => [...current, {
      id: crypto.randomUUID(),
      src: entry.src,
      name: `${entry.itemName} — ${entry.label}`,
      duration: 2.5,
      grade: entry.grade,
    }]);
    toast.success("Added to timeline");
  };

  const gradeScene = (id: string, grade: Grade, preset?: string, note?: string) => {
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === id ? { ...candidate, grade, gradePreset: preset, gradeNote: note } : candidate,
      ),
    );
  };

  const autoGrade = async (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    update(id, { grading: true });
    try {
      const result = await suggestFn({
        data: { imageDataUrl: item.result ?? item.original, presetKeys: PRESETS.map((preset) => preset.key) },
      });
      const preset = presetByKey(result.preset);
      if (preset) gradeScene(id, { ...preset.grade, ...(result.tweaks ?? {}) }, result.preset, result.note);
    } finally {
      update(id, { grading: false });
    }
  };

  const autoGradeAll = async () => {
    await Promise.all(items.map((item) => autoGrade(item.id).catch(() => undefined)));
  };

  const download = (src: string, name: string) => {
    const link = document.createElement("a");
    link.href = src;
    link.download = `${safeName(name)}.png`;
    link.click();
  };

  const downloadZip = async () => {
    if (!items.length) return;
    const zip = new JSZip();
    for (const item of items) {
      const folder = zip.folder(safeName(item.name))!;
      const original = item.original.split(",");
      folder.file(`${safeName(item.name)}-original.${original[0].includes("jpeg") ? "jpg" : "png"}`, original[1], { base64: true });
      if (item.result) {
        const result = item.result.split(",");
        folder.file(`${safeName(item.name)}-clean-plate.png`, result[1], { base64: true });
      }
      item.variants.forEach((variant, index) => {
        const image = variant.src.split(",");
        folder.file(`${safeName(item.name)}-angle-${index + 1}-${safeName(variant.label)}.png`, image[1], { base64: true });
      });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "scene-weaver.zip";
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${items.length} scene${items.length === 1 ? "" : "s"}`);
  };

  const activeImage = active?.result ?? active?.original ?? null;
  const completed = useMemo(() => items.filter((item) => item.result), [items]);

  if (loading || !user) {
    return <div className="aurora-page-shell flex min-h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="aurora-page-shell min-h-screen text-foreground">
      <Toaster />
      <header className="border-b border-white/8 bg-black/20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <Link to="/home" className="rounded-lg p-2 text-white/50 hover:bg-white/8 hover:text-white"><ArrowLeft className="size-4" /></Link>
            <div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.22em]"><span className="size-2 rounded-full bg-primary" />Scene Weaver</div><p className="mt-1 text-xs text-white/40">Keep the scene. Change the angle.</p></div>
          </div>
          <div className="flex gap-2">
            <button disabled={!activeImage} onClick={() => activeImage && download(activeImage, active?.name ?? "scene")} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 disabled:opacity-40"><Download className="mr-1.5 inline size-3.5" />Save frame</button>
            <button disabled={!items.length} onClick={() => void downloadZip()} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Download className="mr-1.5 inline size-3.5" />Export ZIP</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7">
        <nav className="mb-6 flex flex-wrap gap-1 rounded-xl border border-white/8 bg-black/20 p-1">
          {([
            ["create", "Create"],
            ["gallery", "Gallery"],
            ["color", "Color"],
            ["board", "Storyboard"],
            ["timeline", "Timeline"],
            ["flows", "Flows"],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setView(key)} className={`rounded-lg px-3 py-2 text-xs transition ${view === key ? "bg-primary/15 text-primary" : "text-white/45 hover:text-white"}`}>{label}</button>
          ))}
        </nav>
        {!items.length ? (
          <section className="mx-auto max-w-3xl py-12">
            <div className="mb-8 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.25em] text-primary">Plate cleanup / camera design</p><h1 className="mt-4 text-5xl font-semibold leading-[.98] tracking-tight sm:text-7xl">Keep the scene.<br /><span className="font-serif italic text-white/45">Change the angle.</span></h1><p className="mt-6 max-w-xl text-sm leading-relaxed text-white/55">Upload a frame, walk the subject out, rebuild the clean plate, and generate a set of production-ready views without leaving your creative direction.</p></div>
            <label className="group flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[.03] p-8 text-center transition hover:border-primary/60 hover:bg-primary/[.04]"><ImagePlus className="size-8 text-primary" /><span className="mt-4 text-sm font-semibold">Drop frames here</span><span className="mt-2 text-xs text-white/40">PNG, JPG, or WEBP · up to 8 MB each</span><input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => event.target.files && void addFiles(event.target.files)} /></label>
          </section>
        ) : view === "gallery" ? (
          <GalleryPanel entries={gallery} onDownload={(entry) => download(entry.src, `${entry.itemName}-${entry.label}`)} onSendToBoard={addShot} onSendToTimeline={addClip} onOpenScene={(id) => { setActiveId(id); setView("create"); }} />
        ) : view === "color" ? (
          <ColorPanel
            scenes={items.map((item) => ({ id: item.id, name: item.name, src: item.result ?? item.original, grade: item.grade, gradePreset: item.gradePreset, gradeNote: item.gradeNote, grading: item.grading }))}
            activeId={activeId}
            onSelect={setActiveId}
            onGrade={gradeScene}
            onAutoGrade={(id) => void autoGrade(id).catch((error) => toast.error(error instanceof Error ? error.message : "Grade suggestion failed"))}
            onAutoGradeAll={() => void autoGradeAll().catch(() => toast.error("Some grade suggestions failed"))}
            autoAllBusy={items.some((item) => item.grading)}
          />
        ) : view === "board" ? (
          <StoryboardPanel shots={shots} onPatch={(id, patch) => setShots((current) => current.map((shot) => shot.id === id ? { ...shot, ...patch } : shot))} onRemove={(id) => setShots((current) => current.filter((shot) => shot.id !== id))} onMove={(id, direction) => setShots((current) => move(current, id, direction))} onToggle={(id) => setShots((current) => current.map((shot) => shot.id === id ? { ...shot, selected: !shot.selected } : shot))} onToggleAll={(selected) => setShots((current) => current.map((shot) => ({ ...shot, selected })))} onExport={() => toast.info("Contact sheet export is available from the selected board.")} onExportZip={() => toast.info("ZIP export is available from the selected board.")} exporting={null} />
        ) : view === "timeline" ? (
          <TimelinePanel clips={clips} onPatch={(id, patch) => setClips((current) => current.map((clip) => clip.id === id ? { ...clip, ...patch } : clip))} onRemove={(id) => setClips((current) => current.filter((clip) => clip.id !== id))} onMove={(id, direction) => setClips((current) => move(current, id, direction))} onAddAll={() => setClips((current) => [...current, ...items.filter((item) => item.result).map((item) => ({ id: crypto.randomUUID(), src: item.result!, name: item.name, duration: 2.5, grade: NEUTRAL_GRADE }))])} canAddAll={items.some((item) => item.result)} />
        ) : view === "flows" ? (
          <FlowsPanel seedImage={activeImage} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[.03] px-3 py-4 text-xs text-white/60 hover:border-primary/60"><Upload className="size-4" />Add frames<input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => event.target.files && void addFiles(event.target.files)} /></label>
              {items.map((item) => <button key={item.id} onClick={() => setActiveId(item.id)} className={`group flex w-full items-center gap-3 rounded-xl border p-2 text-left ${item.id === activeId ? "border-primary/60 bg-primary/[.06]" : "border-white/8 bg-white/[.02]"}`}><img src={item.result ?? item.original} alt="" className="size-14 rounded-lg object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-xs text-white/80">{item.name}</span><span className="mt-1 block text-[10px] uppercase tracking-widest text-white/35">{item.status === "done" ? <><Check className="mr-1 inline size-3 text-emerald-400" />Ready</> : item.status}</span></span><span onClick={(event) => { event.stopPropagation(); removeItem(item.id); }} className="rounded p-1 text-white/25 hover:text-white"><X className="size-3" /></span></button>)}
              <button disabled={batchBusy || !completed.length} onClick={() => void runSelectedAngles()} className="w-full rounded-xl border border-white/10 px-3 py-3 text-xs text-white/65 disabled:opacity-40"><Rotate3d className="mr-2 inline size-4" />Run selected angles</button>
            </aside>

            {active && <section className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{active.name}</h2><p className="mt-1 text-xs text-white/40">Source frame → clean plate → alternate views</p></div><div className="flex items-center gap-2"><button onClick={() => setShowMap((value) => !value)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55"><Rotate3d className="mr-1 inline size-3.5" />Map</button>{activeImage && <button onClick={() => download(activeImage, active.name)} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white"><Download className="mr-1 inline size-3.5" />Save frame</button>}</div></div>
              {active.result ? <BeforeAfter beforeSrc={active.original} afterSrc={active.result} /> : <div className="flex aspect-video items-center justify-center rounded-xl border border-white/10 bg-black/30">{active.status === "processing" ? <Loader2 className="size-6 animate-spin text-primary" /> : <p className="text-sm text-white/45">{active.error ?? "Preparing scene…"}</p>}</div>}
              <div className="grid gap-4 xl:grid-cols-2"><RebuildPanel busy={active.status === "processing"} upscaling={active.upscaleBusy} canUndo={!!active.previous} onRebuild={(instruction) => void rebuild(instruction)} onUndo={() => update(active.id, { result: active.previous, previous: null })} onUpscale={(factor) => void upscale(factor)} /><AssistantPanel messages={active.chat} busy={false} onSend={(text) => void sendChat(text)} /></div>
              <MultiAngleNodeBoard nodes={active.nodes} running={active.angleBusy || batchBusy} onToggle={(nodeId) => update(active.id, { nodes: active.nodes.map((node) => node.id === nodeId ? { ...node, enabled: !node.enabled } : node) })} onRunAll={() => void runSelectedAngles()} onRunOne={(nodeId) => { const node = active.nodes.find((candidate) => candidate.id === nodeId); if (node) void runAngle(node.id, node.prompt, node.label); }} />
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-white/55"><Camera className="size-4 text-primary" /> Custom camera move</div><div className="flex gap-2"><input value={customAngle} onChange={(event) => setCustomAngle(event.target.value)} placeholder="e.g. dolly 20° right, keep the same lens" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-primary" /><button disabled={!customAngle.trim() || active.angleBusy} onClick={() => { void runAngle("custom-angle", customAngle.trim(), "Custom angle"); setCustomAngle(""); }} className="rounded-lg bg-white/8 px-3 py-2 text-xs text-white/70 disabled:opacity-40"><Sparkles className="mr-1 inline size-3.5" />Generate</button></div></div>
              {active.variants.length > 0 && <div><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[.2em] text-white/50">Generated angles</h3><span className="text-[10px] text-white/30">{active.variants.length} views</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{active.variants.map((variant) => <button key={variant.id} onClick={() => download(variant.src, `${active.name}-${variant.label}`)} className="group overflow-hidden rounded-xl border border-white/8 bg-white/[.03] text-left"><img src={variant.src} alt={variant.label} className="aspect-video w-full object-cover transition group-hover:scale-105" /><span className="block truncate px-2 py-2 text-[10px] uppercase tracking-widest text-white/50">{variant.label}</span></button>)}</div></div>}
            </section>}
          </div>
        )}
      </main>
      {showMap && activeImage && <Minimap3D src={activeImage} label={`${active?.name ?? "Scene"} preview`} />}
    </div>
  );
}