import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { AUDIO_ACCEPT } from "@/lib/utils";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  generatePerformanceShot,
  generateVideoFromImage,
  lipSyncVideo,
  generateSplitReality,
} from "@/lib/studio.functions";
import { listWorkflows, saveWorkflow, getWorkflow } from "@/lib/workflows.functions";
import {
  getMarketplaceTemplateForCanvas,
  chargeMarketplaceTemplateRun,
} from "@/lib/marketplace.functions";
import { handleGenerationError } from "@/lib/error-toasts";
import { listComfyTemplates, startComfyRun } from "@/lib/comfy.functions";
import { MODEL_LIST, VIDEO_MODEL_LIST, getModelMeta } from "@/lib/models";
import {
  Sparkles,
  Play,
  Loader2,
  Image as ImageIcon,
  Film,
  Wand2,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  FolderOpen,
  Mic,
  Music,
  SplitSquareHorizontal,
  Boxes,
  Undo2,
  Redo2,
  RotateCcw,
  Download,
  Share2,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SplitRealityPlayer } from "@/components/canvas/SplitRealityPlayer";

import { TrendingTemplatesMenu, type TemplateGraph, getTemplateById } from "@/components/canvas/TrendingTemplatesMenu";
import { AuroraAgentPanel } from "@/components/canvas/AuroraAgentPanel";
import { FinishedWorkflowsGallery } from "@/components/canvas/FinishedWorkflowsGallery";


export const Route = createFileRoute("/canvas")({
  component: CanvasPage,
  head: () => ({
    meta: [
      { title: "Canvas — Aurora Orchestration" },
      { name: "description", content: "Node-based AI orchestration. Chain models, add lip-sync, motion and color in one trending workflow." },
      { property: "og:title", content: "Aurora Canvas — Trending AI workflows" },
      { property: "og:description", content: "Drag, chain and run multi-model AI workflows with an in-canvas agent." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/canvas" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/canvas" }],
  }),
});

type NodeKind = "input" | "audio" | "image" | "video" | "lipsync" | "split" | "comfy";
type NodeData = {
  kind: NodeKind;
  label?: string; // optional human label (e.g. the camera angle for reshoot recipes)
  comfyWorkflowId?: string;
  outputKind?: "image" | "video";
  url?: string;
  altUrl?: string; // secondary output (e.g. split-reality cinematic still)
  videoUrl?: string; // animated version of `url` for split-reality playback
  altVideoUrl?: string; // animated version of `altUrl`
  prompt?: string;
  model?: string;
  cameraMovement?: string;
  status?: "idle" | "running" | "done" | "error";
  error?: string;
  animating?: boolean;
};

const initialNodes: Node<NodeData>[] = [
  { id: "in", position: { x: 40, y: 80 }, data: { kind: "input" }, type: "aurora" },
  { id: "aud", position: { x: 40, y: 420 }, data: { kind: "audio" }, type: "aurora" },
  {
    id: "img",
    position: { x: 420, y: 60 },
    data: {
      kind: "image",
      prompt: "",
      model: MODEL_LIST[0].value,
      status: "idle",
    },
    type: "aurora",
  },
  {
    id: "vid",
    position: { x: 820, y: 60 },
    data: {
      kind: "video",
      prompt: "subject performs, expressive body language, locked camera",
      model: VIDEO_MODEL_LIST[0].value,
      cameraMovement: "static",
      status: "idle",
    },
    type: "aurora",
  },
  {
    id: "ls",
    position: { x: 1220, y: 220 },
    data: { kind: "lipsync", model: "fal-ai/sync-lipsync/v2", status: "idle" },
    type: "aurora",
  },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "in", target: "img", animated: true },
  { id: "e2", source: "img", target: "vid", animated: true },
  { id: "e3", source: "vid", target: "ls", animated: true },
  { id: "e4", source: "aud", target: "ls", animated: true },
];

type Handlers = {
  update: (id: string, patch: Partial<NodeData>) => void;
  remove: (id: string) => void;
  onFile: (id: string, file: File) => void;
  animateSplit: (id: string) => void;
};
const HandlersCtx = createContext<Handlers | null>(null);

type ComfyTemplate = {
  id: string;
  name: string;
  kind: "image" | "video";
  declared_inputs: { key: string; label: string; type: string }[];
};
const ComfyCtx = createContext<ComfyTemplate[]>([]);

function ComfyNodeControls({ id, data }: { id: string; data: NodeData }) {
  const h = useContext(HandlersCtx)!;
  const templates = useContext(ComfyCtx);
  const tpl = templates.find((t) => t.id === data.comfyWorkflowId);
  const hasText = (tpl?.declared_inputs ?? []).some((d) => d.type === "text");
  return (
    <>
      <Select value={data.comfyWorkflowId ?? ""} onValueChange={(v) => h.update(id, { comfyWorkflowId: v })}>
        <SelectTrigger className="h-8 text-xs nodrag bg-black/30 border-white/10">
          <SelectValue placeholder="Pick a workflow" />
        </SelectTrigger>
        <SelectContent>
          {templates.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No workflows — add on /comfy</div>
          )}
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id} className="text-xs">
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasText && (
        <Textarea
          rows={2}
          value={data.prompt ?? ""}
          onChange={(e) => h.update(id, { prompt: e.target.value })}
          placeholder="prompt → first text input"
          className="text-xs resize-none nodrag bg-black/30 border-white/10"
          onMouseDownCapture={(e) => e.stopPropagation()}
        />
      )}
      <p className="text-[10px] text-muted-foreground">
        {tpl
          ? `${tpl.kind} · binds upstream image(s) into the graph's image inputs`
          : "Runs a saved ComfyUI graph on your GPU worker."}
      </p>
    </>
  );
}

const CAMERA_OPTIONS = [
  ["static", "Static"],
  ["push_in", "Push in"],
  ["pull_out", "Pull out"],
  ["zoom_in", "Zoom in"],
  ["zoom_out", "Zoom out"],
  ["pan_left", "Pan left"],
  ["pan_right", "Pan right"],
  ["tilt_up", "Tilt up"],
  ["tilt_down", "Tilt down"],
  ["orbit_cw", "Orbit CW"],
  ["orbit_ccw", "Orbit CCW"],
] as const;

const KIND_META: Record<NodeKind, { label: string; Icon: typeof ImageIcon; accent: string }> = {
  input: { label: "image input", Icon: ImageIcon, accent: "from-cyan-400 to-blue-500" },
  audio: { label: "audio input", Icon: Music, accent: "from-emerald-400 to-teal-500" },
  image: { label: "image gen", Icon: Wand2, accent: "from-fuchsia-400 to-purple-500" },
  video: { label: "video gen", Icon: Film, accent: "from-purple-400 to-indigo-500" },
  lipsync: { label: "lip sync", Icon: Mic, accent: "from-rose-400 to-pink-500" },
  split: { label: "split reality", Icon: SplitSquareHorizontal, accent: "from-amber-400 to-orange-500" },
  comfy: { label: "comfyui", Icon: Boxes, accent: "from-sky-400 to-cyan-500" },
};

function AuroraNode({ id, data }: NodeProps<Node<NodeData>>) {
  const h = useContext(HandlersCtx)!;
  const meta = data.model ? getModelMeta(data.model) : null;
  const showTarget = !(data.kind === "input" || data.kind === "audio");
  const showSource = data.kind !== "lipsync";
  const km = KIND_META[data.kind];
  const Icon = km.Icon;

  return (
    <div className="group relative rounded-2xl w-[300px] overflow-hidden">
      {/* neon border gradient */}
      <div
        className={`absolute -inset-[1px] rounded-2xl bg-gradient-to-br ${km.accent} opacity-60 group-hover:opacity-100 blur-[2px] transition-opacity`}
      />
      <div className="relative rounded-2xl border border-white/10 bg-[oklch(0.13_0.04_290/0.85)] backdrop-blur-xl shadow-[0_0_40px_-10px_oklch(0.78_0.18_305/0.5)] overflow-hidden">
        {showTarget && (
          <Handle
            type="target"
            position={Position.Left}
            className="!w-3 !h-3 !bg-primary !border-2 !border-background !shadow-[0_0_8px_oklch(0.78_0.18_305/0.9)]"
          />
        )}
        {showSource && (
          <Handle
            type="source"
            position={Position.Right}
            className="!w-3 !h-3 !bg-primary !border-2 !border-background !shadow-[0_0_8px_oklch(0.78_0.18_305/0.9)]"
          />
        )}

        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between text-[10px]">
          <span className="font-mono uppercase tracking-[0.15em] flex items-center gap-1.5 text-foreground/80">
            <span className={`size-4 rounded grid place-items-center bg-gradient-to-br ${km.accent} text-white`}>
              <Icon className="size-2.5" />
            </span>
            {km.label}
            {data.label && <span className="text-primary/90 normal-case tracking-normal font-semibold">· {data.label}</span>}
            <span className="text-foreground/40">#{id.slice(0, 4)}</span>
          </span>
          <div className="flex items-center gap-2">
            {data.status === "running" && <Loader2 className="size-3 animate-spin text-primary" />}
            {data.status === "done" && <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />}
            {data.status === "error" && (
              <span title={data.error} className="size-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
            )}
            {!["in", "img", "vid", "aud", "ls"].includes(id) && (
              <button onClick={() => h.remove(id)} className="text-muted-foreground hover:text-rose-400">
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* preview */}
        {data.kind === "split" && (data.url || data.altUrl) ? (
          <SplitRealityPlayer
            ultra={{ url: data.url, videoUrl: data.videoUrl, label: "ULTRA" }}
            cinematic={{ url: data.altUrl, videoUrl: data.altVideoUrl, label: "CINEMATIC" }}
            prompt={data.prompt}
            animating={data.animating}
            onAnimateBoth={() => h.animateSplit(id)}
          />
        ) : data.url ? (
          data.kind === "video" || data.kind === "lipsync" || (data.kind === "comfy" && data.outputKind === "video") ? (
            <AutoplayVideo src={data.url} className="w-full aspect-square object-cover" autoPlay={false} playsInline controls />
          ) : data.kind === "audio" ? (
            <div className="p-3 bg-black/30">
              <audio src={data.url} controls className="w-full" />
            </div>
          ) : (
            <div className="relative group/img">
              <img src={data.url} alt="" className="w-full aspect-square object-cover" />
              {data.kind === "input" && (
                <label
                  className="absolute inset-x-2 bottom-2 text-[11px] text-center py-1.5 rounded-md bg-black/70 text-white opacity-0 group-hover/img:opacity-100 transition-opacity cursor-pointer nodrag"
                  onMouseDownCapture={(e) => e.stopPropagation()}
                >
                  Swap image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && h.onFile(id, e.target.files[0])}
                  />
                </label>
              )}
            </div>
          )
        ) : null}

        <div className="p-3 space-y-2">
          {data.kind === "input" && !data.url && (
            <label
              className="relative block cursor-pointer nodrag rounded-xl border-2 border-dashed border-cyan-400/40 bg-cyan-500/5 hover:border-cyan-400/80 hover:bg-cyan-500/10 transition-colors p-4 text-center"
              onMouseDownCapture={(e) => e.stopPropagation()}
            >
              <div className="size-10 mx-auto rounded-full grid place-items-center bg-cyan-500/20 text-cyan-200 mb-2">
                <ImageIcon className="size-5" />
              </div>
              <div className="text-xs font-semibold text-white">Drop your image here</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">or click to upload (PNG/JPG · selfie, product, screenshot)</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && h.onFile(id, e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          )}
          {data.kind === "audio" && !data.url && (
            <label
              className="relative block cursor-pointer nodrag rounded-xl border-2 border-dashed border-emerald-400/40 bg-emerald-500/5 hover:border-emerald-400/80 hover:bg-emerald-500/10 transition-colors p-4 text-center"
              onMouseDownCapture={(e) => e.stopPropagation()}
            >
              <div className="size-10 mx-auto rounded-full grid place-items-center bg-emerald-500/20 text-emerald-200 mb-2">
                <Music className="size-5" />
              </div>
              <div className="text-xs font-semibold text-white">Drop audio here</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">mp3 or wav · the voice/song to lip-sync</div>
              <input
                type="file"
                accept={AUDIO_ACCEPT}
                onChange={(e) => e.target.files?.[0] && h.onFile(id, e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          )}
          {(data.kind === "image" || data.kind === "video") && (
            <>
              <Textarea
                rows={2}
                value={data.prompt ?? ""}
                onChange={(e) => h.update(id, { prompt: e.target.value })}
                className="text-xs resize-none nodrag bg-black/30 border-white/10"
                onMouseDownCapture={(e) => e.stopPropagation()}
              />
              {data.kind === "image" && (
                <Select value={data.model} onValueChange={(v) => h.update(id, { model: v })}>
                  <SelectTrigger className="h-8 text-xs nodrag bg-black/30 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODEL_LIST.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {data.kind === "video" && (
                <div className="grid grid-cols-2 gap-2">
                  <Select value={data.model} onValueChange={(v) => h.update(id, { model: v })}>
                    <SelectTrigger className="h-8 text-xs nodrag bg-black/30 border-white/10"><SelectValue placeholder="Model" /></SelectTrigger>
                    <SelectContent>
                      {VIDEO_MODEL_LIST.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={data.cameraMovement ?? "static"} onValueChange={(v) => h.update(id, { cameraMovement: v })}>
                    <SelectTrigger className="h-8 text-xs nodrag bg-black/30 border-white/10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CAMERA_OPTIONS.map(([v, l]) => (
                        <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {meta && <p className="text-[10px] text-muted-foreground">{meta.tagline}</p>}
            </>
          )}
          {data.kind === "lipsync" && (
            <>
              <Select value={data.model ?? "fal-ai/sync-lipsync/v2"} onValueChange={(v) => h.update(id, { model: v })}>
                <SelectTrigger className="h-8 text-xs nodrag bg-black/30 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fal-ai/sync-lipsync/v2" className="text-xs">Sync 1.9 (premium)</SelectItem>
                  <SelectItem value="fal-ai/wav2lip" className="text-xs">Wav2Lip (fast)</SelectItem>
                  <SelectItem value="latentsync" className="text-xs">LatentSync (self-hosted)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Connect a video (or image — auto-animated first) + an audio node.
              </p>
            </>
          )}
          {data.kind === "split" && (
            <>
              <Textarea
                rows={2}
                value={data.prompt ?? ""}
                onChange={(e) => h.update(id, { prompt: e.target.value })}
                placeholder="Optional base description"
                className="text-xs resize-none nodrag bg-black/30 border-white/10"
                onMouseDownCapture={(e) => e.stopPropagation()}
              />
              <p className="text-[10px] text-muted-foreground">
                Generates two stories side by side: ultra-real vs cinematic.
              </p>
            </>
          )}
          {data.kind === "comfy" && <ComfyNodeControls id={id} data={data} />}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { aurora: AuroraNode };

// ── Progress panel: live per-node queue status + ETA ─────────────────────
function estimateSeconds(kind: NodeKind): number {
  switch (kind) {
    case "image": return 25;
    case "video": return 75;
    case "lipsync": return 90;
    case "split": return 50;
    case "comfy": return 60;
    default: return 5;
  }
}
function ProgressPanel({ nodes, edges, running }: { nodes: Node<NodeData>[]; edges: Edge[]; running: boolean }) {
  const steps = nodes.filter((n) => ["image", "video", "lipsync", "split", "comfy"].includes(n.data.kind));
  if (steps.length === 0) return null;
  const done = steps.filter((n) => n.data.status === "done").length;
  const active = steps.find((n) => n.data.status === "running");
  const errored = steps.filter((n) => n.data.status === "error");
  const pending = steps.filter((n) => !n.data.status || n.data.status === "idle");
  const etaSec = (active ? estimateSeconds(active.data.kind) / 2 : 0)
    + pending.reduce((s, n) => s + estimateSeconds(n.data.kind), 0);
  const pct = Math.round((done / steps.length) * 100);
  if (!running && done === 0 && errored.length === 0) return null;
  return (
    <div className="absolute bottom-3 right-3 z-30 w-[280px] rounded-xl border border-white/10 bg-[oklch(0.13_0.04_290/0.92)] backdrop-blur-xl shadow-[0_0_30px_oklch(0.78_0.18_305/0.4)] p-3 hidden md:block">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-mono uppercase tracking-[0.15em] text-white/70 flex items-center gap-1.5">
          <Clock className="size-3" /> Pipeline · {done}/{steps.length}
        </div>
        {running && <Loader2 className="size-3 animate-spin text-primary" />}
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
        <div className="h-full bg-gradient-to-r from-primary to-fuchsia-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {running && active && (
        <div className="text-[10px] text-white/60 mb-2">
          ETA ~{Math.max(5, Math.round(etaSec))}s · running {KIND_META[active.data.kind].label}
        </div>
      )}
      <ul className="space-y-1 max-h-44 overflow-y-auto">
        {steps.map((n) => {
          const s = n.data.status ?? "idle";
          return (
            <li key={n.id} className="flex items-center gap-2 text-[11px]">
              {s === "done" ? <CheckCircle2 className="size-3 text-emerald-400" /> :
               s === "running" ? <Loader2 className="size-3 animate-spin text-primary" /> :
               s === "error" ? <XCircle className="size-3 text-rose-400" /> :
               <span className="size-3 rounded-full border border-white/20" />}
              <span className="text-white/80 truncate">{KIND_META[n.data.kind].label}</span>
              <span className="text-white/30 ml-auto">#{n.id.slice(0, 4)}</span>
            </li>
          );
        })}
      </ul>
      {errored.length > 0 && (
        <div className="mt-2 text-[10px] text-rose-300 truncate" title={errored[0].data.error}>
          {errored[0].data.error ?? "Step failed"}
        </div>
      )}
    </div>
  );
}

// ── Export / share dock: download final + copy share link ────────────────
function ExportShareDock({ nodes, edges }: { nodes: Node<NodeData>[]; edges: Edge[] }) {
  // Terminal = a node with a result url that has no outgoing edges
  const outgoing = new Set(edges.map((e) => e.source));
  const terminals = nodes.filter(
    (n) => !outgoing.has(n.id)
      && n.data.status === "done"
      && (n.data.url || n.data.altUrl)
      && ["image", "video", "lipsync", "split", "comfy"].includes(n.data.kind),
  );
  if (terminals.length === 0) return null;
  const final = terminals[terminals.length - 1];
  const url = final.data.url || final.data.altUrl!;
  const isVideo =
    final.data.kind === "video" ||
    final.data.kind === "lipsync" ||
    (final.data.kind === "comfy" && final.data.outputKind === "video");

  const download = async () => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      const ext = isVideo ? "mp4" : "png";
      a.href = URL.createObjectURL(blob);
      a.download = `aurora-canvas-${final.id}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast.success("Downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="absolute bottom-3 left-3 z-30 hidden md:flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-[oklch(0.13_0.04_290/0.92)] backdrop-blur-xl shadow-[0_0_30px_oklch(0.62_0.22_165/0.3)] p-2">
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-emerald-300 px-1">Final · {KIND_META[final.data.kind].label}</span>
      <Button size="sm" variant="outline" onClick={download} className="border-white/10 bg-white/5">
        <Download className="size-3.5 mr-1" /> Download
      </Button>
      <Button size="sm" onClick={share} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
        <Share2 className="size-3.5 mr-1" /> Share
      </Button>
    </div>
  );
}

function CanvasPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  // Deep-link: /canvas?template=<id> or ?marketplaceTemplateId=<uuid> auto-loads once.
  // Marketplace templates are fetched server-side (no graph JSON in URL) and charged
  // only on the first "Run pipeline" click (see runMut below).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("template");
    const mktId = params.get("marketplaceTemplateId");

    if (mktId) {
      const url = new URL(window.location.href);
      url.searchParams.delete("marketplaceTemplateId");
      window.history.replaceState({}, "", url.toString());
      setMarketplaceTemplateId(mktId);
      mktLoadFn({ data: { id: mktId } })
        .then((result) => {
          const g = result.graph;
          if (g && Array.isArray(g.nodes) && Array.isArray(g.edges)) {
            setNodes(g.nodes as Node<NodeData>[]);
            setEdges(g.edges as Edge[]);
            setCoachTplName(g.name ?? "Marketplace template");
            setLastTemplateGraph(g);
            toast.success(
              `Loaded "${g.name ?? "marketplace template"}" — ${result.run_cost_aura} Aura charged per run`,
            );
          }
        })
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : "Failed to load template");
        });
      return;
    }

    if (!id) return;
    const g = getTemplateById(id);
    if (g) {
      setNodes(g.nodes);
      setEdges(g.edges);
      setCoachTplName(g.name);
      setLastTemplateId(id);
      setLastTemplateGraph(g);
      setMarketplaceTemplateId(null);
      toast.success(`Loaded "${g.name}"`);
      // Clear the param so a refresh doesn't keep resetting the canvas.
      const url = new URL(window.location.href);
      url.searchParams.delete("template");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [agentOpen, setAgentOpen] = useState(false);
  const [coachTplName, setCoachTplName] = useState<string | null>(null);
  const [lastTemplateId, setLastTemplateId] = useState<string | null>(null);
  const [lastTemplateGraph, setLastTemplateGraph] = useState<TemplateGraph | null>(null);

  // ── Undo / Redo history ───────────────────────────────────────────────────
  type Snapshot = { nodes: Node<NodeData>[]; edges: Edge[] };
  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const skipHistoryRef = useRef(false);
  const lastSigRef = useRef<string>("");
  const [, forceHistTick] = useState(0);
  const prevStateRef = useRef<Snapshot | null>(null);

  // Snapshot when structural data changes (not on every drag tick).
  useEffect(() => {
    if (skipHistoryRef.current) { skipHistoryRef.current = false; return; }
    const sig = JSON.stringify({
      n: nodes.map((n) => ({ id: n.id, k: n.data.kind, u: n.data.url, p: n.data.prompt, m: n.data.model, c: n.data.cameraMovement })),
      e: edges.map((e) => `${e.source}->${e.target}`),
    });
    if (sig === lastSigRef.current) return;
    if (lastSigRef.current && prevStateRef.current) {
      pastRef.current.push(prevStateRef.current);
      futureRef.current = [];
      if (pastRef.current.length > 50) pastRef.current.shift();
    }
    lastSigRef.current = sig;
    prevStateRef.current = {
      nodes: nodes.map((n) => ({ ...n, data: { ...n.data } })),
      edges: edges.map((e) => ({ ...e })),
    };
    forceHistTick((x) => x + 1);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    const snap = pastRef.current.pop();
    if (!snap) return;
    futureRef.current.push(prevStateRef.current ?? { nodes, edges });
    skipHistoryRef.current = true;
    prevStateRef.current = snap;
    lastSigRef.current = "";
    setNodes(snap.nodes);
    setEdges(snap.edges);
    forceHistTick((x) => x + 1);
  }, [nodes, edges, setNodes, setEdges]);
  const redo = useCallback(() => {
    const snap = futureRef.current.pop();
    if (!snap) return;
    pastRef.current.push(prevStateRef.current ?? { nodes, edges });
    skipHistoryRef.current = true;
    prevStateRef.current = snap;
    lastSigRef.current = "";
    setNodes(snap.nodes);
    setEdges(snap.edges);
    forceHistTick((x) => x + 1);
  }, [nodes, edges, setNodes, setEdges]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && /input|textarea/i.test(tgt.tagName)) return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const resetTemplate = useCallback(() => {
    const g = lastTemplateGraph ?? (lastTemplateId ? getTemplateById(lastTemplateId) : null);
    if (!g) { toast.error("Load a template first"); return; }
    setNodes(g.nodes);
    setEdges(g.edges);
    toast.success(`Reset "${g.name}"`);
  }, [lastTemplateId, lastTemplateGraph, setNodes, setEdges]);

  const onConnect = useCallback((p: Connection) => setEdges((es) => addEdge({ ...p, animated: true }, es)), [setEdges]);

  const mktLoadFn = useServerFn(getMarketplaceTemplateForCanvas);
  const mktChargeFn = useServerFn(chargeMarketplaceTemplateRun);
  // ID of a marketplace template currently loaded in this session (if any).
  // Set to null whenever the user loads a non-marketplace template/workflow so
  // the charge gate is always scoped to the actual marketplace-origin graph.
  const [marketplaceTemplateId, setMarketplaceTemplateId] = useState<string | null>(null);

  const genFn = useServerFn(generatePerformanceShot);
  const vidFn = useServerFn(generateVideoFromImage);
  const lipFn = useServerFn(lipSyncVideo);
  const splitFn = useServerFn(generateSplitReality);
  const comfyRunFn = useServerFn(startComfyRun);
  const comfyListFn = useServerFn(listComfyTemplates);
  const comfyTplQuery = useQuery({
    queryKey: ["comfy-templates-canvas"],
    enabled: !!user,
    queryFn: () => comfyListFn({}),
  });
  const comfyTemplates = (comfyTplQuery.data?.templates ?? []) as unknown as ComfyTemplate[];

  const update = useCallback((id: string, patch: Partial<NodeData>) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, [setNodes]);

  const remove = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  const onFile = useCallback(async (id: string, file: File) => {
    if (!user) return;
    const path = `${user.id}/canvas/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); return; }
    const { data: signed, error: signErr } = await supabase.storage
      .from("studio").createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) { toast.error(signErr?.message ?? "Could not sign URL"); return; }
    update(id, { url: signed.signedUrl });
  }, [user, update]);

  const animateSplit = useCallback(async (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node || node.data.kind !== "split") return;
    const { url, altUrl, prompt } = node.data;
    if (!url || !altUrl) { toast.error("Run the split first to get both stills"); return; }
    update(id, { animating: true });
    try {
      const motion = (label: string) =>
        `${label} cinematic motion, subtle parallax, breathing camera, natural micro-expressions${prompt ? `. ${prompt}` : ""}`;
      const [a, b] = await Promise.all([
        vidFn({ data: { imageUrl: url, prompt: motion("Ultra-realism"), duration: 5, resolution: "720p", modelKey: VIDEO_MODEL_LIST[0].value, cameraMovement: "push_in", endFrameUrl: null } }),
        vidFn({ data: { imageUrl: altUrl, prompt: motion("Cinematic vision"), duration: 5, resolution: "720p", modelKey: VIDEO_MODEL_LIST[0].value, cameraMovement: "orbit_cw", endFrameUrl: null } }),
      ]);
      update(id, { videoUrl: a.videoUrl, altVideoUrl: b.videoUrl, animating: false });
      toast.success("Both stories animated");
    } catch (e) {
      update(id, { animating: false });
      handleGenerationError(e);
    }
  }, [nodes, update]);

  const handlers = useMemo<Handlers>(() => ({ update, remove, onFile, animateSplit }), [update, remove, onFile, animateSplit]);

  const runMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in");

      // Charge marketplace template fee on every Run (per-run model).
      // marketplaceTemplateId is cleared when loading any non-marketplace template,
      // so this only fires when the canvas was seeded from the marketplace.
      if (marketplaceTemplateId) {
        const chargeResult = await mktChargeFn({ data: { id: marketplaceTemplateId } });
        if (!chargeResult.ok) {
          throw new Error(chargeResult.error ?? "Insufficient Aura credits for this template");
        }
      }

      const byId = new Map(nodes.map((n) => [n.id, { ...n, data: { ...n.data } }]));
      const outgoing = new Map<string, string[]>();
      const incoming = new Map<string, string[]>();
      edges.forEach((e) => {
        outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e.target]);
        incoming.set(e.target, [...(incoming.get(e.target) ?? []), e.source]);
      });

      type Resolved = { url: string; kind: NodeKind };
      const resolved = new Map<string, Resolved>();

      // seed inputs (image + audio)
      const seeds = nodes.filter((n) => n.data.kind === "input" || n.data.kind === "audio");
      if (seeds.length === 0) throw new Error("Add at least one input node");
      const queue: string[] = [];
      for (const n of seeds) {
        if (!n.data.url) throw new Error(`Upload a file into the ${n.data.kind} node`);
        resolved.set(n.id, { url: n.data.url, kind: n.data.kind });
        for (const t of outgoing.get(n.id) ?? []) queue.push(t);
      }

      const seen = new Set<string>();
      while (queue.length) {
        const id = queue.shift()!;
        if (seen.has(id)) continue;
        // require all upstream resolved before processing
        const ups = incoming.get(id) ?? [];
        if (!ups.every((u) => resolved.has(u))) { queue.push(id); continue; }
        seen.add(id);
        const n = byId.get(id);
        if (!n) continue;
        const upstream = ups.map((u) => resolved.get(u)!).filter(Boolean);
        const images = upstream.filter((u) => u.kind === "input" || u.kind === "image" || u.kind === "split").map((u) => u.url);
        const videos = upstream.filter((u) => u.kind === "video" || u.kind === "lipsync").map((u) => u.url);
        const audios = upstream.filter((u) => u.kind === "audio").map((u) => u.url);

        try {
          update(id, { status: "running", error: undefined });
          if (n.data.kind === "image") {
            if (images.length === 0) throw new Error("Image node needs an image upstream");
            const res = await genFn({ data: {
              prompt: n.data.prompt ?? "cinematic portrait",
              imageUrls: images,
              motionVideoUrl: null,
              model: n.data.model ?? MODEL_LIST[0].value,
            } });
            resolved.set(id, { url: res.resultUrl, kind: "image" });
            update(id, { status: "done", url: res.resultUrl });
          } else if (n.data.kind === "video") {
  if (images.length === 0) throw new Error("Video node needs an image upstream");
  // If we have multiple images (e.g., from split), use second as end frame for motion control
  const endFrame = images.length > 1 ? images[1] : null;
  const res = await vidFn({ data: {
    imageUrl: images[0],
    prompt: n.data.prompt ?? "natural movement",
    duration: 5,
    resolution: "720p",
    modelKey: n.data.model ?? VIDEO_MODEL_LIST[0].value,
    cameraMovement: n.data.cameraMovement ?? "static",
    endFrameUrl: endFrame,  // ✅ Pass end frame if available
  } });
            resolved.set(id, { url: res.videoUrl, kind: "video" });
            update(id, { status: "done", url: res.videoUrl });
          } else if (n.data.kind === "split") {
            if (images.length === 0) throw new Error("Split node needs an image upstream");
            const res = await splitFn({ data: { imageUrls: images.slice(0, 3), basePrompt: n.data.prompt ?? "" } });
            resolved.set(id, { url: res.ultra.url, kind: "split" });
            update(id, { status: "done", url: res.ultra.url, altUrl: res.cinematic.url });
          } else if (n.data.kind === "lipsync") {
            if (audios.length === 0) throw new Error("Lip sync needs an audio node");
            let videoUrl = videos[0];
            if (!videoUrl) {
              // auto-animate the image first
              if (images.length === 0) throw new Error("Lip sync needs a video or image upstream");
              const v = await vidFn({ data: {
                imageUrl: images[0],
                prompt: "subtle talking head movement, natural micro-expressions, locked camera",
                duration: 5,
                resolution: "720p",
                modelKey: VIDEO_MODEL_LIST[0].value,
                cameraMovement: "static",
                endFrameUrl: null,
              } });
              videoUrl = v.videoUrl;
            }
            const res = await lipFn({ data: {
              videoUrl,
              audioUrl: audios[0],
              model: (n.data.model as "fal-ai/sync-lipsync/v2" | "fal-ai/wav2lip" | "latentsync") ?? "fal-ai/sync-lipsync/v2",
            } });
            resolved.set(id, { url: res.videoUrl, kind: "lipsync" });
            update(id, { status: "done", url: res.videoUrl });
          } else if (n.data.kind === "comfy") {
            const tplId = n.data.comfyWorkflowId;
            if (!tplId) throw new Error("Pick a ComfyUI workflow for this node");
            const tpl = comfyTemplates.find((t) => t.id === tplId);
            if (!tpl) throw new Error("This ComfyUI workflow is still loading or unavailable — try again in a moment");
            const declared = tpl.declared_inputs ?? [];
            const values: Record<string, unknown> = {};
            const textKey = declared.find((d) => d.type === "text")?.key;
            if (textKey && n.data.prompt) values[textKey] = n.data.prompt;
            const imageKeys = declared.filter((d) => d.type === "image").map((d) => d.key);
            imageKeys.forEach((k, i) => { if (images[i]) values[k] = images[i]; });
            const res = await comfyRunFn({ data: { workflowId: tplId, values, source: "canvas" } });
            if (!res.ok) throw new Error(res.error ?? "ComfyUI run failed");
            // Trust the server's classified output kind; fall back to the template's
            // declared kind when the URL couldn't be classified (outputKind "unknown").
            const okind: "image" | "video" =
              res.outputKind === "video" || res.outputKind === "image"
                ? res.outputKind
                : tpl.kind === "video"
                  ? "video"
                  : "image";
            resolved.set(id, { url: res.url as string, kind: okind as NodeKind });
            update(id, { status: "done", url: res.url, outputKind: okind });
          } else {
            // passthrough
            if (upstream[0]) resolved.set(id, upstream[0]);
          }
          for (const t of outgoing.get(id) ?? []) queue.push(t);
        } catch (e) {
          update(id, { status: "error", error: e instanceof Error ? e.message : "Failed" });
          throw e;
        }
      }
    },
    onSuccess: () => toast.success("Pipeline complete"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addNode = (kind: NodeKind) => {
    const id = `${kind}-${Date.now()}`;
    setNodes((ns) => [...ns, {
      id,
      position: { x: 200 + Math.random() * 600, y: 120 + Math.random() * 320 },
      type: "aurora",
      data: {
        kind,
        prompt:
          kind === "video" ? "natural movement, expressive performance"
          : kind === "image" ? "describe the shot"
          : kind === "split" ? "" : undefined,
        model:
          kind === "image" ? MODEL_LIST[0].value
          : kind === "video" ? VIDEO_MODEL_LIST[0].value
          : kind === "lipsync" ? "fal-ai/sync-lipsync/v2"
          : undefined,
        cameraMovement: kind === "video" ? "static" : undefined,
        status: "idle",
      } as NodeData,
    }]);
  };

  // Save / Load workflows
  const saveFn = useServerFn(saveWorkflow);
  const listFn = useServerFn(listWorkflows);
  const loadFn = useServerFn(getWorkflow);
  const [wfName, setWfName] = useState("Untitled pipeline");
  const [wfId, setWfId] = useState<string | undefined>(undefined);
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const wfList = useQuery({
    queryKey: ["workflows"], enabled: !!user && loadOpen,
    queryFn: () => listFn({}),
  });
  const saveMut = useMutation({
    mutationFn: async () => {
      const graph = { nodes, edges } as Record<string, unknown>;
      const res = await saveFn({ data: { id: wfId, name: wfName, graph, is_public: false } });
      return res;
    },
    onSuccess: (r) => { if (r?.id) setWfId(r.id); setSaveOpen(false); toast.success("Workflow saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });
  const handleLoad = async (id: string) => {
    try {
      const wf = await loadFn({ data: { id } });
      const g = wf.graph as { nodes?: Node<NodeData>[]; edges?: Edge[] };
      if (g.nodes) setNodes(g.nodes);
      if (g.edges) setEdges(g.edges);
      setWfId(wf.id); setWfName(wf.name);
      setMarketplaceTemplateId(null);
      setLoadOpen(false);
      toast.success(`Loaded ${wf.name}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Load failed"); }
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  return (
    <main className="h-screen flex flex-col bg-background relative overflow-hidden">
      {/* futuristic ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.78_0.18_305/0.18),transparent_60%),radial-gradient(ellipse_at_bottom_right,oklch(0.62_0.22_260/0.15),transparent_55%)]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(oklch(0.78_0.18_305)_1px,transparent_1px),linear-gradient(90deg,oklch(0.78_0.18_305)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute inset-x-0 top-14 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-border bg-background/80 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="size-7 rounded-lg flex items-center justify-center shadow-[0_0_20px_oklch(0.78_0.18_305/0.6)]" style={{ background: "var(--gradient-hero)" }}>
            <Sparkles className="size-3.5 text-primary-foreground" />
          </span>
          <span className="font-mono uppercase tracking-[0.2em] text-sm">Aurora<span className="text-primary">/</span>Canvas</span>
        </Link>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            size="sm"
            variant="premium"
            onClick={() => setAgentOpen(true)}
          >
            <Sparkles className="size-3.5 mr-1" /> Aurora Agent
          </Button>
          <TrendingTemplatesMenu
            onPick={(g: TemplateGraph & { id?: string }) => {
              setNodes(g.nodes);
              setEdges(g.edges);
              setCoachTplName(g.name);
              setLastTemplateGraph(g);
              setMarketplaceTemplateId(null);
              toast.success(`Loaded "${g.name}"`);
            }}
          />
          <Button size="sm" variant="outline" onClick={undo} disabled={pastRef.current.length === 0} className="border-white/10 bg-white/5" title="Undo (⌘Z)"><Undo2 className="size-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={redo} disabled={futureRef.current.length === 0} className="border-white/10 bg-white/5" title="Redo (⌘⇧Z)"><Redo2 className="size-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={resetTemplate} disabled={!lastTemplateGraph && !lastTemplateId} className="border-white/10 bg-white/5" title="Reset template"><RotateCcw className="size-3.5 mr-1" /> Reset</Button>
          <FinishedWorkflowsGallery
            onLoad={(id) => {
              const g = getTemplateById(id);
              if (g) {
                setNodes(g.nodes);
                setEdges(g.edges);
                setCoachTplName(g.name);
                setLastTemplateGraph(g);
                setMarketplaceTemplateId(null);
                toast.success(`Loaded "${g.name}"`);
              } else {
                toast.success(`Opening "${id}" — drag nodes to remix`);
              }
            }}
          />
          <Button size="sm" variant="outline" onClick={() => addNode("input")} className="border-white/10 bg-white/5"><Plus className="size-3.5 mr-1" /> Image</Button>
          <Button size="sm" variant="outline" onClick={() => addNode("audio")} className="border-white/10 bg-white/5"><Music className="size-3.5 mr-1" /> Audio</Button>
          <Button size="sm" variant="outline" onClick={() => addNode("image")} className="border-white/10 bg-white/5"><Wand2 className="size-3.5 mr-1" /> Img gen</Button>
          <Button size="sm" variant="outline" onClick={() => addNode("video")} className="border-white/10 bg-white/5"><Film className="size-3.5 mr-1" /> Video</Button>
          <Button size="sm" variant="outline" onClick={() => addNode("lipsync")} className="border-white/10 bg-white/5"><Mic className="size-3.5 mr-1" /> Lip sync</Button>
          <Button size="sm" variant="outline" onClick={() => addNode("split")} className="border-white/10 bg-white/5"><SplitSquareHorizontal className="size-3.5 mr-1" /> Split</Button>
          <Button size="sm" variant="outline" onClick={() => addNode("comfy")} className="border-white/10 bg-white/5"><Boxes className="size-3.5 mr-1" /> ComfyUI</Button>
          <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-white/10 bg-white/5"><FolderOpen className="size-3.5 mr-1" /> Load</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Load workflow</DialogTitle></DialogHeader>
              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {(wfList.data?.workflows ?? []).map((w) => (
                  <button key={w.id} onClick={() => handleLoad(w.id)} className="w-full text-left py-2.5 px-2 hover:bg-muted rounded-md">
                    <div className="text-sm font-medium">{w.name}</div>
                    <div className="text-xs text-muted-foreground">{new Date(w.updated_at).toLocaleString()}</div>
                  </button>
                ))}
                {wfList.data && wfList.data.workflows.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No saved workflows yet</div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-white/10 bg-white/5"><Save className="size-3.5 mr-1" /> Save</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{wfId ? "Update workflow" : "Save workflow"}</DialogTitle></DialogHeader>
              <Input value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="Workflow name" />
              <DialogFooter>
                <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                  {saveMut.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
                  {wfId ? "Update" : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" onClick={() => runMut.mutate()} disabled={runMut.isPending} style={{ background: "var(--gradient-hero)" }} className="text-primary-foreground shadow-[0_0_24px_oklch(0.78_0.18_305/0.6)]">
            {runMut.isPending ? <><Loader2 className="size-3.5 mr-1 animate-spin" /> Running</> : <><Play className="size-3.5 mr-1" /> Run pipeline</>}
          </Button>
          <Link to="/studio" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">Studio <ArrowRight className="size-3.5" /></Link>
        </div>
      </header>
      <div className="flex-1 relative z-0">
        <ComfyCtx.Provider value={comfyTemplates}>
        <HandlersCtx.Provider value={handlers}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{ animated: true, style: { stroke: "oklch(0.78 0.18 305)", strokeWidth: 1.5, filter: "drop-shadow(0 0 4px oklch(0.78 0.18 305 / 0.6))" } }}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="oklch(0.78 0.18 305 / 0.25)" />
            <MiniMap pannable zoomable className="!bg-[oklch(0.13_0.04_290/0.8)] !border-white/10" maskColor="oklch(0.13 0.04 290 / 0.6)" />
            <Controls className="!bg-[oklch(0.13_0.04_290/0.8)] !border-white/10 [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-foreground" />
          </ReactFlow>
        </HandlersCtx.Provider>
        </ComfyCtx.Provider>
        {/* Quick-start coach mark — appears after loading a template */}
        {coachTplName && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-xl w-[calc(100%-1.5rem)] rounded-xl border border-primary/30 bg-[oklch(0.15_0.05_290/0.95)] backdrop-blur-xl shadow-[0_0_30px_oklch(0.78_0.18_305/0.4)] p-3 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-lg grid place-items-center text-white shrink-0" style={{ background: "var(--gradient-hero)" }}>
                <Sparkles className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{coachTplName} loaded</div>
                <ol className="mt-1 text-[11px] text-white/80 space-y-0.5 list-decimal list-inside">
                  <li>Drop your image/audio into the dashed input nodes on the left.</li>
                  <li>(Optional) Edit any prompt to taste — prefilled ones are tested.</li>
                  <li>Hit <span className="text-primary font-medium">Run pipeline</span> top-right.</li>
                </ol>
              </div>
              <button
                onClick={() => setCoachTplName(null)}
                className="text-white/50 hover:text-white text-xs shrink-0"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {/* Mobile sticky action dock — guarantees Run + node-add are reachable */}
        {/* Generation progress panel */}
        <ProgressPanel nodes={nodes} edges={edges} running={runMut.isPending} />
        {/* Export / share dock */}
        <ExportShareDock nodes={nodes} edges={edges} />
        <div className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2 py-2 rounded-full border border-white/10 bg-[oklch(0.13_0.04_290/0.92)] backdrop-blur-xl shadow-[0_0_30px_oklch(0.78_0.18_305/0.5)] animate-fade-in">
          <button onClick={() => addNode("input")} className="size-9 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="Image"><ImageIcon className="size-4" /></button>
          <button onClick={() => addNode("audio")} className="size-9 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="Audio"><Music className="size-4" /></button>
          <button onClick={() => addNode("video")} className="size-9 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="Video"><Film className="size-4" /></button>
          <button onClick={() => addNode("lipsync")} className="size-9 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="Lip sync"><Mic className="size-4" /></button>
          <button onClick={() => addNode("split")} className="size-9 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="Split"><SplitSquareHorizontal className="size-4" /></button>
          <button onClick={() => addNode("comfy")} className="size-9 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="ComfyUI"><Boxes className="size-4" /></button>
          <button onClick={() => runMut.mutate()} disabled={runMut.isPending} className="ml-1 h-9 px-4 rounded-full text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5 shadow-[0_0_24px_oklch(0.78_0.18_305/0.8)] disabled:opacity-60" style={{ background: "var(--gradient-hero)" }}>
            {runMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Run
          </button>
        </div>
      </div>
      
      <AuroraAgentPanel
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        onSendToCanvas={(g) => { setNodes(g.nodes); setEdges(g.edges); setMarketplaceTemplateId(null); }}
      />
    </main>
  );
}
