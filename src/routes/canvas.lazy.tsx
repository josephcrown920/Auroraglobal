import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PageSpinner } from "@/components/PageSpinner";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import { AUDIO_ACCEPT } from "@/lib/utils";
import { CollectionRunner, formatEtr } from "@/lib/collection-runtime";
import { generateProductVideoHooks, generateStyleBlueprint, type StyleBlueprint } from "@/lib/claude-hooks.functions";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
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
  usePerformanceShotJobFn,
  useVideoFromImageJobFn,
  useLipSyncJobFn,
  pollComfyRunUntilDone,
} from "@/lib/use-job-polling";
import { listWorkflows, saveWorkflow, getWorkflow } from "@/lib/workflows.functions";
import {
  getMarketplaceTemplateForCanvas,
  chargeMarketplaceTemplateRun,
} from "@/lib/marketplace.functions";
import { handleGenerationError, friendlyGenerationMessage } from "@/lib/error-toasts";
import { listComfyTemplates, startComfyRun, getComfyRun } from "@/lib/comfy.functions";
import {
  listAuroraTemplates,
  generateAuroraTemplateVideo,
  type AuroraTemplateRow,
} from "@/lib/aurora-templates.functions";
import { MODEL_LIST, VIDEO_MODEL_LIST, getModelMeta, AUTO_MODEL_OPTIONS, resolveAutoModel } from "@/lib/models";
import {
  Sparkles,
  Play,
  Loader2,
  Image as ImageIcon,
  Film,
  Wand2,
  ArrowRight,
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
  Clock,
  CheckCircle2,
  XCircle,
  Layers,
  MoreVertical,
  Bot,
  Eye,
  Lock,
  Globe,
  CheckCheck,
  AlertCircle,
  Monitor,
  Smartphone,
  Target,
  ShoppingBag,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShareMenu } from "@/components/share/ShareMenu";

import { TrendingTemplatesMenu, type TemplateGraph, getTemplateById } from "@/components/canvas/TrendingTemplatesMenu";
import { AuroraAgentPanel } from "@/components/canvas/AuroraAgentPanel";
import { FinishedWorkflowsGallery, defaultGraphFor } from "@/components/canvas/FinishedWorkflowsGallery";
import { GeneratedAssetGallery } from "@/components/canvas/GeneratedAssetGallery";


export const Route = createLazyFileRoute("/canvas")({ component: CanvasPage });

type NodeKind = "input" | "audio" | "image" | "video" | "lipsync" | "split" | "comfy" | "batchVideo" | "heygenTemplate";
type BatchVariant = { status: "queued" | "running" | "done" | "error"; url?: string; error?: string; approved?: boolean };
type NodeData = {
  kind: NodeKind;
  label?: string;
  comfyWorkflowId?: string;
  outputKind?: "image" | "video";
  url?: string;
  altUrl?: string;
  videoUrl?: string;
  altVideoUrl?: string;
  prompt?: string;
  model?: string;
  cameraMovement?: string;
  status?: "idle" | "running" | "done" | "error";
  error?: string;
  animating?: boolean;
  // batchVideo — fan out one image into N independent video renders
  variantCount?: number;
  resolution?: "480p" | "720p" | "1080p" | "2160p";
  duration?: number;
  variants?: BatchVariant[];
  claudePrompts?: string[];
  productDescription?: string;
  // batchVideo extended settings
  platform?: "tiktok" | "instagram" | "youtube_shorts" | "facebook" | "x" | "linkedin";
  variationStrategy?: "hooks" | "ctas" | "openings" | "story" | "captions" | "mixed";
  outputDuration?: "auto" | "15" | "30" | "45" | "60";
  styleLock?: boolean;
  brandLock?: boolean;
  speakerLock?: boolean;
  styleBlueprint?: StyleBlueprint;
  // batchVideo collection tracking (live-updated during run)
  collectionStartedAt?: number;
  collectionEstimatedMs?: number;
  // heygenTemplate-only
  auroraTemplateId?: string;
  talkingPhotoUrl?: string;
  // outfit / product swap — secondary reference image for try-on / product nodes
  outfitUrl?: string;
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
  onOutfitFile: (id: string, file: File) => void;
  openBatchViewer: (id: string) => void;
};

const OUTFIT_LABELS = /product|try.?on|outfit|top\b|bottom\b|garment|apparel|clothing|fashion/i;
const HandlersCtx = createContext<Handlers | null>(null);

type ComfyTemplate = {
  id: string;
  name: string;
  kind: "image" | "video";
  declared_inputs: { key: string; label: string; type: string }[];
};
const ComfyCtx = createContext<ComfyTemplate[]>([]);
const HeyGenTplCtx = createContext<AuroraTemplateRow[]>([]);

function HeyGenTemplateNodeControls({ id, data }: { id: string; data: NodeData }) {
  const h = useContext(HandlersCtx)!;
  const templates = useContext(HeyGenTplCtx);
  return (
    <>
      <Select
        value={data.auroraTemplateId ?? ""}
        onValueChange={(v) => h.update(id, { auroraTemplateId: v })}
      >
        <SelectTrigger className="h-8 text-xs nodrag bg-black/30 border-white/10">
          <SelectValue placeholder="Pick an Aurora template" />
        </SelectTrigger>
        <SelectContent>
          {templates.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No templates — save one on /heygen-templates</div>
          )}
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={data.talkingPhotoUrl ?? ""}
        onChange={(e) => h.update(id, { talkingPhotoUrl: e.target.value })}
        placeholder="Photo URL (or connect an image node)"
        className="h-8 text-xs nodrag bg-black/30 border-white/10"
        onMouseDownCapture={(e) => e.stopPropagation()}
      />
      <p className="text-[13px] text-muted-foreground">
        {data.auroraTemplateId
          ? "Connects upstream image as talking-head photo — or paste a URL above."
          : "Select a HeyGen template, then supply a face photo."}
      </p>
    </>
  );
}

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
      <p className="text-[13px] text-muted-foreground">
        {tpl
          ? `${tpl.kind} · binds upstream image(s) into the graph's image inputs`
          : "Runs a saved ComfyUI graph on your GPU worker."}
      </p>
    </>
  );
}

function BatchVideoControls({ id, data }: { id: string; data: NodeData }) {
  const h = useContext(HandlersCtx)!;
  const claudeFn = useServerFn(generateProductVideoHooks);
  const blueprintFn = useServerFn(generateStyleBlueprint);
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [customCountMode, setCustomCountMode] = useState(() => !(VARIANT_COUNTS as readonly number[]).includes(data.variantCount ?? 5));
  const [customCountStr, setCustomCountStr] = useState(() => String(data.variantCount ?? 5));

  const count = data.variantCount ?? 5;
  const strategy = data.variationStrategy ?? "mixed";
  const platform = data.platform ?? "tiktok";

  const expandWithClaude = async () => {
    if (!data.productDescription?.trim()) {
      toast.error("Describe your content first");
      return;
    }
    setClaudeLoading(true);
    try {
      const { prompts } = await claudeFn({
        data: { productDescription: data.productDescription, count, strategy, platform },
      });
      h.update(id, { claudePrompts: prompts });
      toast.success(`Claude generated ${prompts.length} unique ${strategy} prompts`);
    } catch (e) {
      handleGenerationError(e);
    } finally {
      setClaudeLoading(false);
    }
  };

  const buildBlueprint = async () => {
    if (!data.productDescription?.trim()) {
      toast.error("Describe your content first");
      return;
    }
    setBlueprintLoading(true);
    try {
      const { blueprint } = await blueprintFn({ data: { description: data.productDescription } });
      h.update(id, { styleBlueprint: blueprint });
      toast.success("Style blueprint generated");
    } catch (e) {
      handleGenerationError(e);
    } finally {
      setBlueprintLoading(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* ── Content description ─────────────── */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Content / Subject</p>
        <Textarea
          rows={2}
          value={data.productDescription ?? ""}
          onChange={(e) => h.update(id, { productDescription: e.target.value })}
          placeholder="Describe your content (e.g. new sneaker drop, fitness coaching, beauty tutorial)"
          className="text-xs resize-none nodrag bg-black/30 border-white/10"
          onMouseDownCapture={(e) => e.stopPropagation()}
        />
      </div>

      {/* ── Style Blueprint ─────────────────── */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={buildBlueprint}
          disabled={blueprintLoading || !data.productDescription?.trim()}
          className="w-full h-7 flex items-center justify-center gap-1.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-xs text-amber-300 disabled:opacity-50 nodrag transition-colors"
          onMouseDownCapture={(e) => e.stopPropagation()}
        >
          {blueprintLoading ? <Loader2 className="size-3 animate-spin" /> : <Target className="size-3" />}
          {blueprintLoading ? "Analysing style…" : "Generate Style Blueprint"}
        </button>
        {data.styleBlueprint && (
          <div className="rounded-lg bg-amber-500/8 border border-amber-400/20 p-2 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-amber-400/70 flex items-center gap-1"><Target className="size-2.5" /> Style Blueprint</p>
              <button type="button" onClick={() => h.update(id, { styleBlueprint: undefined })} className="text-[10px] text-white/30 hover:text-rose-400 nodrag" onMouseDownCapture={(e) => e.stopPropagation()}>clear</button>
            </div>
            {Object.entries(data.styleBlueprint).map(([k, v]) => (
              k !== "brandKeywords" ? (
                <div key={k} className="flex items-start gap-1.5 text-[11px]">
                  <span className="text-white/30 shrink-0 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}:</span>
                  <span className="text-amber-200/70">{v as string}</span>
                </div>
              ) : (
                <div key={k} className="flex flex-wrap gap-1 mt-0.5">
                  {(v as string[]).map((kw) => (
                    <span key={kw} className="text-[10px] bg-amber-500/15 text-amber-300 rounded px-1.5 py-0.5">{kw}</span>
                  ))}
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* ── Platform ────────────────────────── */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Platform</p>
        <div className="grid grid-cols-3 gap-1">
          {PLATFORMS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => h.update(id, { platform: value as NodeData["platform"] })}
              onMouseDownCapture={(e) => e.stopPropagation()}
              className={`h-7 rounded-md text-[11px] font-medium nodrag transition-colors truncate px-1 ${
                platform === value
                  ? "bg-primary/20 border border-primary/40 text-primary"
                  : "bg-white/5 border border-white/10 text-white/50 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Variation Strategy ──────────────── */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Variation Strategy</p>
        <Select value={strategy} onValueChange={(v) => h.update(id, { variationStrategy: v as NodeData["variationStrategy"] })}>
          <SelectTrigger className="h-8 text-xs nodrag bg-black/30 border-white/10"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STRATEGIES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Claude expand ───────────────────── */}
      <button
        type="button"
        onClick={expandWithClaude}
        disabled={claudeLoading || !data.productDescription?.trim()}
        className="w-full h-7 flex items-center justify-center gap-1.5 rounded-md bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/30 text-xs text-violet-300 disabled:opacity-50 nodrag transition-colors"
        onMouseDownCapture={(e) => e.stopPropagation()}
      >
        {claudeLoading ? <Loader2 className="size-3 animate-spin" /> : <Bot className="size-3" />}
        {claudeLoading ? "Claude generating…" : `Generate ${count} unique prompts with Claude`}
      </button>

      {(data.claudePrompts?.length ?? 0) > 0 && (
        <div className="rounded-lg bg-violet-500/10 border border-violet-400/20 p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-violet-400/70">{data.claudePrompts!.length} Claude prompts ready</p>
            <button type="button" onClick={() => h.update(id, { claudePrompts: undefined })} className="text-[10px] text-rose-400/60 hover:text-rose-400 nodrag" onMouseDownCapture={(e) => e.stopPropagation()}>clear</button>
          </div>
          {data.claudePrompts!.slice(0, 3).map((p, i) => (
            <p key={i} className="text-[11px] text-white/60 line-clamp-1">
              <span className="text-violet-400/50 mr-1">#{i + 1}</span>{p}
            </p>
          ))}
          {data.claudePrompts!.length > 3 && (
            <p className="text-[10px] text-white/30">+{data.claudePrompts!.length - 3} more…</p>
          )}
        </div>
      )}

      {/* ── Shared fallback prompt ──────────── */}
      <Textarea
        rows={2}
        value={data.prompt ?? ""}
        onChange={(e) => h.update(id, { prompt: e.target.value })}
        placeholder={(data.claudePrompts?.length ?? 0) > 0 ? "Shared fallback (Claude overrides per-variant)" : "Shared motion description for all variants"}
        className="text-xs resize-none nodrag bg-black/30 border-white/10"
        onMouseDownCapture={(e) => e.stopPropagation()}
      />

      {/* ── Output duration ─────────────────── */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-[0.15em] text-white/40">Target Output Duration</p>
        <div className="grid grid-cols-5 gap-1">
          {OUTPUT_DURATIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => h.update(id, { outputDuration: value as NodeData["outputDuration"] })}
              onMouseDownCapture={(e) => e.stopPropagation()}
              className={`h-7 rounded-md text-[11px] font-medium nodrag transition-colors ${
                (data.outputDuration ?? "auto") === value
                  ? "bg-primary/20 border border-primary/40 text-primary"
                  : "bg-white/5 border border-white/10 text-white/50 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Count · Resolution · Clip Duration ─ */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase tracking-wider text-white/30">Count</p>
          {customCountMode ? (
            <div className="flex gap-1 items-center">
              <Input
                type="number" min={1} max={100}
                value={customCountStr}
                onChange={(e) => {
                  setCustomCountStr(e.target.value);
                  const n = Number(e.target.value);
                  if (n >= 1 && n <= 100) h.update(id, { variantCount: n });
                }}
                className="h-7 text-xs nodrag bg-black/30 border-white/10 flex-1"
                onMouseDownCapture={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                className="text-[10px] text-white/30 hover:text-white/60 nodrag px-1"
                onMouseDownCapture={(e) => e.stopPropagation()}
                onClick={() => setCustomCountMode(false)}
              >✕</button>
            </div>
          ) : (
            <Select
              value={String(count)}
              onValueChange={(v) => {
                if (v === "custom") { setCustomCountMode(true); setCustomCountStr(String(count)); }
                else h.update(id, { variantCount: Number(v) });
              }}
            >
              <SelectTrigger className="h-7 text-xs nodrag bg-black/30 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VARIANT_COUNTS.map((c) => (
                  <SelectItem key={c} value={String(c)} className="text-xs">{c}</SelectItem>
                ))}
                <SelectItem value="custom" className="text-xs text-violet-300">Custom…</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase tracking-wider text-white/30">Resolution</p>
          <Select value={data.resolution ?? "720p"} onValueChange={(v) => h.update(id, { resolution: v as NodeData["resolution"] })}>
            <SelectTrigger className="h-7 text-xs nodrag bg-black/30 border-white/10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RESOLUTION_OPTIONS.map((r) => (
                <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase tracking-wider text-white/30">Clip dur.</p>
          <Select value={String(data.duration ?? 5)} onValueChange={(v) => h.update(id, { duration: Number(v) })}>
            <SelectTrigger className="h-7 text-xs nodrag bg-black/30 border-white/10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((d) => (
                <SelectItem key={d} value={String(d)} className="text-xs">{d}s</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Model ───────────────────────────── */}
      <Select value={data.model} onValueChange={(v) => h.update(id, { model: v })}>
        <SelectTrigger className="h-7 text-xs nodrag bg-black/30 border-white/10"><SelectValue placeholder="Video model" /></SelectTrigger>
        <SelectContent>
          {VIDEO_MODEL_LIST.map((m) => (
            <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* ── Lock toggles ────────────────────── */}
      <div className="rounded-lg bg-white/3 border border-white/8 p-2 space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 flex items-center gap-1"><Lock className="size-2.5" /> Preservation</p>
        {(["styleLock", "brandLock", "speakerLock"] as const).map((key) => {
          const labels = { styleLock: "Style", brandLock: "Brand", speakerLock: "Speaker" };
          const on = data[key] !== false;
          return (
            <button
              key={key}
              type="button"
              onClick={() => h.update(id, { [key]: !on })}
              onMouseDownCapture={(e) => e.stopPropagation()}
              className={`w-full h-6 flex items-center justify-between rounded px-2 text-xs nodrag transition-colors ${
                on ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-white/30"
              }`}
            >
              <span>{labels[key]} Lock</span>
              <span className={`size-2 rounded-full ${on ? "bg-emerald-400" : "bg-white/20"}`} />
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {count} outputs · {platform} · {STRATEGIES.find((s) => s.value === strategy)?.label}
        {(data.claudePrompts?.length ?? 0) > 0 && " · Claude prompts active"}
      </p>
    </div>
  );
}

function BatchOutputViewer({ nodeId, nodes, onClose, onUpdate, onCancel, onPause, onResume, isPaused }: {
  nodeId: string | null;
  nodes: Node<NodeData>[];
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<NodeData>) => void;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  isPaused?: boolean;
}) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node || node.data.kind !== "batchVideo") return null;

  const variants = node.data.variants ?? [];
  const done = variants.filter((v) => v.status === "done").length;
  const failed = variants.filter((v) => v.status === "error").length;
  const running = variants.filter((v) => v.status === "running").length;
  const queued = variants.filter((v) => v.status === "queued").length;
  const approved = variants.filter((v) => v.approved).length;

  const toggleApprove = (i: number) => {
    const updated = variants.map((v, idx) => idx === i ? { ...v, approved: !v.approved } : v);
    onUpdate(node.id, { variants: updated });
  };

  const downloadVariant = async (url: string, i: number) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `batch-${node.id}-v${i + 1}.mp4`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      toast.error("Download failed");
    }
  };

  const deleteVariant = (i: number) => {
    const updated = variants.map((v, idx) =>
      idx === i ? { status: "queued" as const, url: undefined, error: undefined, approved: false } : v
    );
    onUpdate(node.id, { variants: updated });
  };

  return (
    <Sheet open={!!nodeId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto bg-zinc-950 border-white/10 p-0">
        <SheetHeader className="px-6 py-4 border-b border-white/10 sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-md">
          <SheetTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            Batch Output Viewer
            <span className="ml-1 text-xs text-white/40 font-normal">
              {node.data.variantCount ?? variants.length} videos
            </span>
            {node.data.collectionEstimatedMs && running > 0 && (
              <span className="ml-auto text-[11px] text-white/30 font-normal">
                {formatEtr(node.data.collectionEstimatedMs)} left
              </span>
            )}
          </SheetTitle>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <StatPill label="Done" count={done} color="emerald" />
            <StatPill label="Running" count={running} color="blue" />
            <StatPill label="Queued" count={queued} color="amber" />
            <StatPill label="Failed" count={failed} color="rose" />
            {(running > 0 || isPaused) && (
              <div className="ml-auto flex items-center gap-1 shrink-0">
                {isPaused ? (
                  <button
                    type="button"
                    onClick={onResume}
                    className="flex items-center gap-1 h-6 px-2 rounded bg-emerald-500/20 border border-emerald-400/30 text-[11px] text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                  >
                    <Play className="size-3" /> Resume
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onPause}
                    className="flex items-center gap-1 h-6 px-2 rounded bg-white/8 border border-white/10 text-[11px] text-white/60 hover:text-white transition-colors"
                  >
                    <Pause className="size-3" /> Pause
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex items-center gap-1 h-6 px-2 rounded bg-rose-500/15 border border-rose-400/20 text-[11px] text-rose-400 hover:bg-rose-500/25 transition-colors"
                >
                  <XCircle className="size-3" /> Cancel
                </button>
              </div>
            )}
          </div>
          {variants.length > 0 && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                style={{ width: `${Math.round((done / variants.length) * 100)}%` }}
              />
            </div>
          )}
        </SheetHeader>

        {variants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-white/30">
            <Layers className="size-10 mb-3 opacity-30" />
            <p className="text-sm">Run the pipeline to generate outputs</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4">
            {variants.map((v, i) => (
              <div
                key={i}
                className={`relative rounded-xl overflow-hidden border transition-all ${
                  v.approved
                    ? "border-emerald-400/50 ring-1 ring-emerald-400/30"
                    : "border-white/10"
                } bg-black/40`}
              >
                {/* video / state */}
                <div className="relative aspect-[9/16] bg-white/5 flex items-center justify-center">
                  {v.status === "done" && v.url ? (
                    <AutoplayVideo
                      src={v.url}
                      className="absolute inset-0 w-full h-full object-cover"
                      autoPlay={false}
                      playsInline
                      controls
                    />
                  ) : v.status === "running" ? (
                    <div className="flex flex-col items-center gap-2 text-white/40">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <span className="text-xs">Generating…</span>
                    </div>
                  ) : v.status === "error" ? (
                    <div className="flex flex-col items-center gap-2 text-rose-400 px-3 text-center">
                      <AlertCircle className="size-6" />
                      <span className="text-xs line-clamp-3">{v.error ?? "Failed"}</span>
                    </div>
                  ) : (
                    <span className="size-3 rounded-full border border-white/20" />
                  )}
                  {/* variant number badge */}
                  <span className="absolute top-2 left-2 text-[10px] font-bold bg-black/60 text-white/60 rounded px-1.5 py-0.5">
                    #{i + 1}
                  </span>
                  {/* approved badge */}
                  {v.approved && (
                    <span className="absolute top-2 right-2 size-5 rounded-full bg-emerald-400 flex items-center justify-center">
                      <CheckCheck className="size-3 text-black" />
                    </span>
                  )}
                </div>
                {/* claude prompt snippet */}
                {node.data.claudePrompts?.[i] && (
                  <div className="px-2 py-1.5 border-t border-white/5">
                    <p className="text-[10px] text-white/40 line-clamp-2">{node.data.claudePrompts[i]}</p>
                  </div>
                )}
                {/* actions */}
                <div className="flex items-center gap-1 p-1.5 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => toggleApprove(i)}
                    className={`flex-1 h-7 rounded-md text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
                      v.approved
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                        : "bg-white/5 text-white/50 hover:text-white border border-white/10"
                    }`}
                  >
                    <CheckCheck className="size-3" />
                    {v.approved ? "Approved" : "Approve"}
                  </button>
                  {v.url && (
                    <button
                      type="button"
                      onClick={() => void downloadVariant(v.url!, i)}
                      title="Download"
                      className="size-7 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white flex items-center justify-center"
                    >
                      <Download className="size-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteVariant(i)}
                    title="Clear"
                    className="size-7 rounded-md bg-white/5 border border-white/10 text-white/30 hover:text-rose-400 flex items-center justify-center"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StatPill({ label, count, color }: { label: string; count: number; color: "emerald" | "rose" | "blue" | "amber" }) {
  const colors = {
    emerald: "bg-emerald-500/15 text-emerald-300",
    rose: "bg-rose-500/15 text-rose-300",
    blue: "bg-blue-500/15 text-blue-300",
    amber: "bg-amber-500/15 text-amber-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 ${colors[color]}`}>
      {count} {label}
    </span>
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
  split: { label: "split", Icon: Layers, accent: "from-amber-400 to-orange-500" },
  comfy: { label: "comfyui", Icon: Boxes, accent: "from-sky-400 to-cyan-500" },
  batchVideo: { label: "batch video", Icon: Layers, accent: "from-violet-400 to-fuchsia-500" },
  heygenTemplate: { label: "heygen template", Icon: Sparkles, accent: "from-pink-400 to-rose-500" },
};

const VARIANT_COUNTS = [3, 5, 10, 15, 20, 30] as const;
const RESOLUTION_OPTIONS = ["480p", "720p", "1080p", "2160p"] as const;
const DURATION_OPTIONS = [5, 8, 10, 15] as const;
const PLATFORMS = [
  { value: "tiktok", label: "TikTok", Icon: Smartphone },
  { value: "instagram", label: "Instagram", Icon: Smartphone },
  { value: "youtube_shorts", label: "YouTube Shorts", Icon: Monitor },
  { value: "facebook", label: "Facebook", Icon: Globe },
  { value: "x", label: "X / Twitter", Icon: Globe },
  { value: "linkedin", label: "LinkedIn", Icon: Monitor },
] as const;
const STRATEGIES = [
  { value: "hooks", label: "Different Hooks" },
  { value: "ctas", label: "Different CTAs" },
  { value: "openings", label: "Different Openings" },
  { value: "story", label: "Different Story Structure" },
  { value: "captions", label: "Caption-Driven" },
  { value: "mixed", label: "Mixed (recommended)" },
] as const;
const OUTPUT_DURATIONS = [
  { value: "auto", label: "Auto" },
  { value: "15", label: "15 sec" },
  { value: "30", label: "30 sec" },
  { value: "45", label: "45 sec" },
  { value: "60", label: "60 sec" },
] as const;

function AuroraNode({ id, data }: NodeProps<Node<NodeData>>) {
  const h = useContext(HandlersCtx)!;
  const meta = data.model ? getModelMeta(data.model) : null;
  const showTarget = !(data.kind === "input" || data.kind === "audio");
  const showSource = data.kind !== "lipsync" && data.kind !== "heygenTemplate";
  const km = KIND_META[data.kind];
  const Icon = km.Icon;

  return (
    <div
      className="group relative w-[300px] aurora-canvas-node"
      data-running={data.status === "running" ? "1" : "0"}
      data-done={data.status === "done" ? "1" : "0"}
      data-error={data.status === "error" ? "1" : "0"}
    >
      <div className="rounded-[13px] overflow-hidden">
        {showTarget && (
          <Handle
            type="target"
            position={Position.Left}
            className="aurora-canvas-handle !w-3.5 !h-3.5 !bg-white !border-[2.5px] !border-[#07070e] nodrag"
          />
        )}
        {showSource && (
          <Handle
            type="source"
            position={Position.Right}
            className="aurora-canvas-handle !w-3.5 !h-3.5 !bg-white !border-[2.5px] !border-[#07070e] nodrag"
          />
        )}

        <div className="px-3 py-2 border-b border-white/[0.08] flex items-center justify-between text-[13px] bg-white/[0.03]">
          <span className="uppercase tracking-[0.15em] flex items-center gap-1.5 text-white/75">
            <span className={`size-5 rounded-md grid place-items-center bg-gradient-to-br ${km.accent} text-white shadow-[0_0_8px_currentColor]`}>
              <Icon className="size-3" />
            </span>
            {km.label}
            {data.label && <span className="text-[oklch(0.72_0.28_325)] normal-case tracking-normal font-semibold">· {data.label}</span>}
          </span>
          <div className="flex items-center gap-2">
            {data.status === "running" && (
              <span className="inline-flex items-center gap-1 text-[10px] text-violet-300">
                <Loader2 className="size-2.5 animate-spin" /> running
              </span>
            )}
            {data.status === "done" && (
              <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_#34d399]" />
            )}
            {data.status === "error" && (
              <span title={data.error} className="size-2 rounded-full bg-rose-500 shadow-[0_0_8px_2px_#f43f5e]" />
            )}
            {!["in", "img", "vid", "aud", "ls"].includes(id) && (
              <button onClick={() => h.remove(id)} className="text-white/20 hover:text-rose-400 transition-colors">
                <Trash2 className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* preview */}
        {data.kind === "batchVideo" && (data.variants?.length ?? 0) > 0 ? (
          <div className="bg-black/30">
            {/* stats bar */}
            <div className="px-2 py-1.5 flex items-center gap-2 border-b border-white/5">
              {(() => {
                const vs = data.variants!;
                const total = vs.length;
                const doneC = vs.filter((v) => v.status === "done").length;
                const failC = vs.filter((v) => v.status === "error").length;
                const runC = vs.filter((v) => v.status === "running").length;
                const queuedC = vs.filter((v) => v.status === "queued").length;
                const pct = total > 0 ? Math.round((doneC / total) * 100) : 0;
                const etr = data.collectionEstimatedMs ? formatEtr(data.collectionEstimatedMs) : "";
                return (
                  <>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-white/50 shrink-0 tabular-nums">{doneC}/{total}</span>
                    {queuedC > 0 && <span className="text-[10px] text-sky-400/70 shrink-0">{queuedC}q</span>}
                    {failC > 0 && <span className="text-[10px] text-rose-400 shrink-0">{failC}✗</span>}
                    {runC > 0 && <Loader2 className="size-2.5 animate-spin text-primary shrink-0" />}
                    {etr && <span className="text-[9px] text-white/30 shrink-0">{etr}</span>}
                  </>
                );
              })()}
            </div>
            {/* preview grid — first 4 */}
            <div className="grid grid-cols-2 gap-1 p-1.5">
              {data.variants!.slice(0, 4).map((v, i) => (
                <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-white/5 grid place-items-center">
                  {v.status === "done" && v.url ? (
                    <AutoplayVideo src={v.url} className="w-full h-full object-cover" autoPlay={false} playsInline controls />
                  ) : v.status === "running" ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : v.status === "error" ? (
                    <span title={v.error} className="text-rose-400"><XCircle className="size-4" /></span>
                  ) : (
                    <span className="size-1.5 rounded-full border border-white/20" />
                  )}
                  <span className="absolute top-1 left-1 text-[9px] text-white/50 bg-black/50 rounded px-1">#{i + 1}</span>
                  {v.approved && <span className="absolute top-1 right-1 size-3.5 rounded-full bg-emerald-400 grid place-items-center"><CheckCheck className="size-2 text-black" /></span>}
                </div>
              ))}
            </div>
            {/* view outputs button */}
            <div className="px-2 pb-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); h.openBatchViewer(id); }}
                onMouseDownCapture={(e) => e.stopPropagation()}
                className="w-full h-7 rounded-md bg-white/8 hover:bg-white/15 border border-white/10 text-xs text-white/60 hover:text-white flex items-center justify-center gap-1.5 nodrag transition-colors"
              >
                <Eye className="size-3" /> View all {data.variants!.length} outputs
                {data.variants!.length > 4 && <span className="text-white/30">+{data.variants!.length - 4} more</span>}
              </button>
            </div>
          </div>
        ) : data.kind === "heygenTemplate" && data.url ? (
          <AutoplayVideo src={data.url} className="w-full aspect-video object-cover" autoPlay={false} playsInline controls />
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
                  className="absolute inset-x-2 bottom-2 text-sm text-center py-1.5 rounded-md bg-black/70 text-white opacity-70 hover:opacity-100 transition-opacity cursor-pointer nodrag"
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
              <div className="text-[13px] text-muted-foreground mt-0.5">or click to upload (PNG/JPG · selfie, product, screenshot)</div>
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
              <div className="text-[13px] text-muted-foreground mt-0.5">mp3 or wav · the voice/song to lip-sync</div>
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
                    {AUTO_MODEL_OPTIONS.map((a) => (
                      <SelectItem key={a.value} value={a.value} className="text-xs font-semibold text-violet-300">{a.label}</SelectItem>
                    ))}
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
                      {AUTO_MODEL_OPTIONS.map((a) => (
                        <SelectItem key={a.value} value={a.value} className="text-xs font-semibold text-violet-300">{a.label}</SelectItem>
                      ))}
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
              {meta && <p className="text-[13px] text-muted-foreground">{meta.tagline}</p>}
              {OUTFIT_LABELS.test(data.label ?? "") && (
                <div className="border border-white/10 rounded-lg p-2 space-y-1.5">
                  <div className="text-[11px] uppercase tracking-[0.15em] text-white/40 flex items-center gap-1.5">
                    <ShoppingBag className="size-3" /> Outfit / Product
                  </div>
                  {data.outfitUrl ? (
                    <div className="relative">
                      <img src={data.outfitUrl} alt="outfit" className="w-full h-16 rounded-md object-cover" />
                      <label
                        className="absolute inset-x-1 bottom-1 text-[11px] text-center py-0.5 rounded bg-black/70 text-white/70 hover:text-white cursor-pointer nodrag transition-colors"
                        onMouseDownCapture={(e) => e.stopPropagation()}
                      >
                        Change
                        <input type="file" accept="image/*" className="hidden"
                          onChange={(e) => e.target.files?.[0] && h.onOutfitFile(id, e.target.files[0])} />
                      </label>
                    </div>
                  ) : (
                    <label
                      className="relative block cursor-pointer nodrag rounded-lg border border-dashed border-fuchsia-400/30 bg-fuchsia-500/5 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/10 transition-colors p-2.5 text-center"
                      onMouseDownCapture={(e) => e.stopPropagation()}
                    >
                      <div className="text-[12px] text-white/50">Upload outfit / product photo</div>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => e.target.files?.[0] && h.onOutfitFile(id, e.target.files[0])} />
                    </label>
                  )}
                </div>
              )}
            </>
          )}
          {data.kind === "lipsync" && (
            <>
              <Select value={data.model ?? "fal-ai/sync-lipsync/v2"} onValueChange={(v) => h.update(id, { model: v })}>
                <SelectTrigger className="h-8 text-xs nodrag bg-black/30 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUTO_MODEL_OPTIONS.map((a) => (
                    <SelectItem key={a.value} value={a.value} className="text-xs font-semibold text-violet-300">{a.label}</SelectItem>
                  ))}
                  <SelectItem value="fal-ai/sync-lipsync/v2" className="text-xs">Sync 1.9 (premium)</SelectItem>
                  <SelectItem value="fal-ai/wav2lip" className="text-xs">Wav2Lip (fast)</SelectItem>
                  <SelectItem value="latentsync" className="text-xs">LatentSync (self-hosted)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[13px] text-muted-foreground">
                Connect a video (or image — auto-animated first) + an audio node.
              </p>
            </>
          )}
          {data.kind === "comfy" && <ComfyNodeControls id={id} data={data} />}
          {data.kind === "heygenTemplate" && !data.url && <HeyGenTemplateNodeControls id={id} data={data} />}
          {data.kind === "batchVideo" && (
            <BatchVideoControls id={id} data={data} />
          )}
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
    case "comfy": return 60;
    case "heygenTemplate": return 120;
    default: return 5;
  }
}
function ProgressPanel({ nodes, edges, running }: { nodes: Node<NodeData>[]; edges: Edge[]; running: boolean }) {
  const steps = nodes.filter((n) => ["image", "video", "lipsync", "comfy", "heygenTemplate"].includes(n.data.kind));
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
    <div className="absolute bottom-20 right-3 z-30 w-[260px] max-w-[calc(100%-1.5rem)] rounded-xl border border-white/10 bg-[oklch(0.13_0.04_290/0.92)] backdrop-blur-xl shadow-[0_0_30px_oklch(0.78_0.18_305/0.4)] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm uppercase tracking-[0.15em] text-white/70 flex items-center gap-1.5">
          <Clock className="size-3" /> Pipeline · {done}/{steps.length}
        </div>
        {running && <Loader2 className="size-3 animate-spin text-primary" />}
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
        <div className="h-full bg-gradient-to-r from-primary to-fuchsia-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {running && active && (
        <div className="text-[13px] text-white/60 mb-2">
          ETA ~{Math.max(5, Math.round(etaSec))}s · running {KIND_META[active.data.kind].label}
        </div>
      )}
      <ul className="space-y-1 max-h-44 overflow-y-auto">
        {steps.map((n) => {
          const s = n.data.status ?? "idle";
          return (
            <li key={n.id} className="flex items-center gap-2 text-sm">
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
        <div className="mt-2 text-[13px] text-rose-300 truncate" title={errored[0].data.error}>
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
      && ["image", "video", "lipsync", "comfy", "heygenTemplate"].includes(n.data.kind),
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
  return (
    <div className="absolute bottom-20 left-3 z-30 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl border border-emerald-400/30 bg-[oklch(0.13_0.04_290/0.92)] backdrop-blur-xl shadow-[0_0_30px_oklch(0.62_0.22_165/0.3)] p-2">
      <span className="text-[13px] uppercase tracking-[0.15em] text-emerald-300 px-1">Final · {KIND_META[final.data.kind].label}</span>
      <Button size="sm" variant="outline" onClick={download} className="border-white/10 bg-white/5">
        <Download className="size-3.5 mr-1" /> Download
      </Button>
      <ShareMenu
        triggerClassName="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-gradient-to-r from-emerald-500 to-teal-500 text-white disabled:opacity-50"
        getShareTarget={() => ({
          url,
          text: final.data.prompt,
          assetUrl: url,
          filename: `aurora-canvas-${final.id}.${isVideo ? "mp4" : "png"}`,
        })}
      />
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

  const genFn = usePerformanceShotJobFn();
  const vidFn = useVideoFromImageJobFn();
  const lipFn = useLipSyncJobFn();
  const comfyRunFn = useServerFn(startComfyRun);
  const comfyGetRunFn = useServerFn(getComfyRun);
  const comfyListFn = useServerFn(listComfyTemplates);
  const comfyTplQuery = useQuery({
    queryKey: ["comfy-templates-canvas"],
    enabled: !!user,
    queryFn: () => comfyListFn({}),
  });
  const comfyTemplates = (comfyTplQuery.data?.templates ?? []) as unknown as ComfyTemplate[];

  const generateTplCanvasFn = useServerFn(generateAuroraTemplateVideo);
  const auroraListFn = useServerFn(listAuroraTemplates);
  const auroraTemplatesQuery = useQuery({
    queryKey: ["aurora-templates-canvas"],
    enabled: !!user,
    queryFn: () => auroraListFn({}),
  });
  const auroraTemplates = (auroraTemplatesQuery.data ?? []) as AuroraTemplateRow[];

  const update = useCallback((id: string, patch: Partial<NodeData>) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, [setNodes]);

  const remove = useCallback((id: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
  }, [setNodes, setEdges]);

  const updateVariant = useCallback((id: string, index: number, patch: Partial<BatchVariant>) => {
    setNodes((ns) => ns.map((n) => {
      if (n.id !== id) return n;
      const variants = (n.data.variants ?? []).map((v, i) => (i === index ? { ...v, ...patch } : v));
      return { ...n, data: { ...n.data, variants } };
    }));
  }, [setNodes]);

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

  const onOutfitFile = useCallback(async (id: string, file: File) => {
    if (!user) return;
    const path = `${user.id}/canvas/outfit-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("studio").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); return; }
    const { data: signed, error: signErr } = await supabase.storage
      .from("studio").createSignedUrl(path, 60 * 60);
    if (signErr || !signed?.signedUrl) { toast.error(signErr?.message ?? "Could not sign outfit URL"); return; }
    update(id, { outfitUrl: signed.signedUrl });
  }, [user, update]);

  const [batchViewerNodeId, setBatchViewerNodeId] = useState<string | null>(null);
  const openBatchViewer = useCallback((id: string) => setBatchViewerNodeId(id), []);
  const handlers = useMemo<Handlers>(() => ({ update, remove, onFile, onOutfitFile, openBatchViewer }), [update, remove, onFile, onOutfitFile, openBatchViewer]);
  const collectionRunnerRef = useRef<CollectionRunner<number, { id: string; videoUrl: string; preview: boolean }> | null>(null);
  const [batchPaused, setBatchPaused] = useState(false);

  // Pre-flight graph validation: compute blocking issues before the user hits Run.
  // Returns a list of human-readable problems; an empty array means the graph is
  // ready to execute. Currently checks lipsync nodes for missing audio and for
  // missing image/video input.
  const graphWarnings = useMemo<string[]>(() => {
    const inc = new Map<string, string[]>();
    edges.forEach((e) => inc.set(e.target, [...(inc.get(e.target) ?? []), e.source]));
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const issues: string[] = [];
    for (const n of nodes) {
      if (n.data.kind === "lipsync") {
        const ups = (inc.get(n.id) ?? []).map((u) => nodeMap.get(u)).filter(Boolean);
        const hasAudio = ups.some((u) => u!.data.kind === "audio");
        const hasMedia = ups.some((u) => u && ["input", "image", "video", "lipsync", "split", "comfy", "batchVideo"].includes(u.data.kind));
        if (!hasAudio) issues.push("Lip sync node needs an audio node connected");
        if (!hasMedia) issues.push("Lip sync node needs an image or video node connected");
      }
    }
    return issues;
  }, [nodes, edges]);

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
      // Standalone heygenTemplate nodes (no incoming edges, no input seeds) can run via their own talkingPhotoUrl
      const heygenStandalones = nodes.filter(
        (n) => n.data.kind === "heygenTemplate" && !(incoming.get(n.id) ?? []).length
      );
      if (seeds.length === 0 && heygenStandalones.length === 0) throw new Error("Add at least one input node");
      const queue: string[] = [];
      for (const n of seeds) {
        if (!n.data.url) throw new Error(`Upload a file into the ${n.data.kind} node`);
        resolved.set(n.id, { url: n.data.url, kind: n.data.kind });
        for (const t of outgoing.get(n.id) ?? []) queue.push(t);
      }
      for (const n of heygenStandalones) queue.push(n.id);

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
        const images = upstream.filter((u) => u.kind === "input" || u.kind === "image").map((u) => u.url);
        const videos = upstream.filter((u) => u.kind === "video" || u.kind === "lipsync").map((u) => u.url);
        const audios = upstream.filter((u) => u.kind === "audio").map((u) => u.url);

        try {
          update(id, { status: "running", error: undefined });
          if (n.data.kind === "image") {
            if (images.length === 0) throw new Error("Image node needs an image upstream");
            const imageUrls = n.data.outfitUrl ? [...images, n.data.outfitUrl] : images;
            const res = await genFn({ data: {
              prompt: n.data.prompt ?? "cinematic portrait",
              imageUrls,
              motionVideoUrl: null,
              model: resolveAutoModel(n.data.model ?? MODEL_LIST[0].value, "image"),
            } });
            resolved.set(id, { url: res.resultUrl, kind: "image" });
            update(id, { status: "done", url: res.resultUrl });
          } else if (n.data.kind === "video") {
  if (images.length === 0 && videos.length === 0) throw new Error("Video node needs an image or video upstream");
  // Prefer an upstream image as the start frame; fall back to an upstream video
  // (e.g., video→video re-animate, or comfy video output feeding a video node).
  const startFrame = images[0] ?? videos[0];
  // If we have multiple images (e.g., from split), use the second as the end frame for motion control
  const endFrame = images.length > 1 ? images[1] : null;
  const res = await vidFn({ data: {
    imageUrl: startFrame,
    prompt: n.data.prompt ?? "natural movement",
    duration: 5,
    resolution: "720p",
    modelKey: resolveAutoModel(n.data.model ?? VIDEO_MODEL_LIST[0].value, "video"),
    cameraMovement: n.data.cameraMovement ?? "static",
    endFrameUrl: endFrame,
  } });
            resolved.set(id, { url: res.videoUrl, kind: "video" });
            update(id, { status: "done", url: res.videoUrl });
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
              model: resolveAutoModel(n.data.model ?? "fal-ai/sync-lipsync/v2", "lipsync") as "fal-ai/sync-lipsync/v2" | "fal-ai/wav2lip" | "latentsync",
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
            // Enqueue-only server fn (task #273): the graph renders in the
            // background job queue — poll the run row until it goes terminal.
            const done = await pollComfyRunUntilDone(comfyGetRunFn, (res.run as { id: string }).id);
            if (!done.output_url) throw new Error("ComfyUI run finished without an output");
            // Trust the server's classified output kind; fall back to the template's
            // declared kind when the URL couldn't be classified (outputKind "unknown").
            const okind: "image" | "video" =
              done.output_kind === "video" || done.output_kind === "image"
                ? done.output_kind
                : tpl.kind === "video"
                  ? "video"
                  : "image";
            resolved.set(id, { url: done.output_url, kind: okind as NodeKind });
            update(id, { status: "done", url: done.output_url, outputKind: okind });
          } else if (n.data.kind === "heygenTemplate") {
            const tplId = n.data.auroraTemplateId;
            if (!tplId) throw new Error("Pick an Aurora template for this node");
            const tpl = auroraTemplates.find((t) => t.id === tplId);
            if (!tpl) throw new Error("Aurora template still loading — try again in a moment");
            const photoUrl = images[0] ?? n.data.talkingPhotoUrl?.trim();
            if (!photoUrl) throw new Error("Connect an image node or paste a photo URL in the HeyGen Template node");
            const res = await generateTplCanvasFn({
              data: {
                auroraTemplateId: tplId,
                character: {
                  name: tpl.character_variable_key,
                  type: "character" as const,
                  properties: { type: "talking_photo", character_id: photoUrl },
                },
              },
            });
            if (!res.ok) {
              throw new Error(res.error ?? "HeyGen template generation failed");
            }
            resolved.set(id, { url: res.url, kind: "heygenTemplate" });
            update(id, { status: "done", url: res.url });
          } else if (n.data.kind === "batchVideo") {
            if (images.length === 0) throw new Error("Batch video needs an image upstream");
            const count = Math.min(100, Math.max(1, n.data.variantCount ?? 3));
            update(id, {
              variants: Array.from({ length: count }, () => ({ status: "queued" }) as BatchVariant),
              collectionStartedAt: Date.now(),
              collectionEstimatedMs: undefined,
            });
            const runner = new CollectionRunner<number, { id: string; videoUrl: string; preview: boolean }>(
              `batch-${id}-${Date.now()}`, "batchVideo", Array.from({ length: count }, (_, i) => i),
            );
            collectionRunnerRef.current = runner;
            setBatchPaused(false);
            // Snapshot node data before async execution (avoids stale closure over React state)
            const batchImageUrl = images[0];
            const batchPrompts = n.data.claudePrompts;
            const batchPrompt = n.data.prompt;
            const batchDuration = n.data.duration ?? 5;
            const batchResolution = n.data.resolution ?? "720p";
            const batchModelKey = resolveAutoModel(n.data.model ?? VIDEO_MODEL_LIST[0].value, "video");
            let firstSuccessUrl: string | undefined;
            await runner.run({
              concurrency: 5,
              execute: async (item) => {
                return vidFn({ data: {
                  imageUrl: batchImageUrl,
                  prompt: batchPrompts?.[item] ?? batchPrompt ?? "natural movement, expressive performance",
                  duration: batchDuration,
                  resolution: batchResolution,
                  modelKey: batchModelKey,
                  cameraMovement: "static",
                  endFrameUrl: null,
                } });
              },
              onItemStart: (i) => updateVariant(id, i, { status: "running" }),
              onItemDone: (i, res) => {
                updateVariant(id, i, { status: "done", url: res.videoUrl });
                if (!firstSuccessUrl) firstSuccessUrl = res.videoUrl;
              },
              onItemError: (i, err) => {
                updateVariant(id, i, { status: "error", error: err.message });
                handleGenerationError(err);
              },
              onProgress: (snap) => {
                update(id, { collectionEstimatedMs: snap.estimatedMs });
              },
            });
            const finalSnap = runner.snapshot();
            if (runner.isCancelled) {
              update(id, { status: "idle", collectionEstimatedMs: undefined });
              toast.info("Batch generation cancelled");
              return;
            }
            if (!firstSuccessUrl) throw new Error("All batch video variants failed");
            resolved.set(id, { url: firstSuccessUrl, kind: "video" });
            update(id, { status: "done", url: firstSuccessUrl, collectionEstimatedMs: undefined });
            if (finalSnap.failed > 0) {
              toast.error(`${finalSnap.failed} of ${count} batch variants failed — the rest completed and were charged individually`);
            }
          } else {
            // passthrough
            if (upstream[0]) resolved.set(id, upstream[0]);
          }
          for (const t of outgoing.get(id) ?? []) queue.push(t);
        } catch (e) {
          update(id, { status: "error", error: friendlyGenerationMessage(e) });
          throw e;
        }
      }
    },
    onSuccess: () => toast.success("Pipeline complete"),
    onError: (e) => handleGenerationError(e),
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
          : undefined,
        model:
          kind === "image" ? MODEL_LIST[0].value
          : kind === "video" ? VIDEO_MODEL_LIST[0].value
          : kind === "lipsync" ? "fal-ai/sync-lipsync/v2"
          : kind === "batchVideo" ? VIDEO_MODEL_LIST[0].value
          : undefined,
        cameraMovement: kind === "video" ? "static" : undefined,
        variantCount: kind === "batchVideo" ? 5 : undefined,
        resolution: kind === "batchVideo" ? "720p" : undefined,
        duration: kind === "batchVideo" ? 5 : undefined,
        variants: kind === "batchVideo" ? [] : undefined,
        platform: kind === "batchVideo" ? "tiktok" : undefined,
        variationStrategy: kind === "batchVideo" ? "mixed" : undefined,
        outputDuration: kind === "batchVideo" ? "auto" : undefined,
        styleLock: kind === "batchVideo" ? true : undefined,
        brandLock: kind === "batchVideo" ? true : undefined,
        speakerLock: kind === "batchVideo" ? false : undefined,
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

  if (loading || !user) return <PageSpinner />;

  return (
    <main className="h-screen flex flex-col bg-[#06060c] relative overflow-hidden">
      {/* ambient fuchsia halo at top, matching xyflow dark aesthetic */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_40%_at_50%_0%,oklch(0.70_0.32_325/0.10),transparent)]" />
        <div className="absolute inset-x-0 top-14 h-px bg-gradient-to-r from-transparent via-[oklch(0.70_0.32_325/0.4)] to-transparent" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-background/70 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight shrink-0">
          <span className="size-8 rounded-xl flex items-center justify-center shadow-[0_0_24px_oklch(0.78_0.18_305/0.65)]" style={{ background: "var(--gradient-hero)" }}>
            <Sparkles className="size-4 text-primary-foreground" />
          </span>
          <span className="uppercase tracking-[0.2em] text-xs text-foreground/90">Canvas</span>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button size="sm" variant="premium" onClick={() => setAgentOpen(true)} className="h-8">
            <Sparkles className="size-3.5 mr-1" /> Agent
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (graphWarnings.length) { toast.error(graphWarnings[0]); return; }
              runMut.mutate();
            }}
            disabled={runMut.isPending}
            title={graphWarnings.length ? graphWarnings[0] : undefined}
            style={{ background: "var(--gradient-hero)" }}
            className="h-8 text-primary-foreground shadow-[0_0_24px_oklch(0.78_0.18_305/0.55)]"
          >
            {runMut.isPending ? <><Loader2 className="size-3.5 mr-1 animate-spin" /> Running</> : <><Play className="size-3.5 mr-1" /> Run</>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 border-white/10 bg-white/5" aria-label="Canvas menu">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={undo} disabled={pastRef.current.length === 0}>
                <Undo2 className="size-3.5 mr-2" /> Undo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={redo} disabled={futureRef.current.length === 0}>
                <Redo2 className="size-3.5 mr-2" /> Redo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={resetTemplate} disabled={!lastTemplateGraph && !lastTemplateId}>
                <RotateCcw className="size-3.5 mr-2" /> Reset template
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setTimeout(() => setSaveOpen(true), 0)}>
                <Save className="size-3.5 mr-2" /> Save workflow
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTimeout(() => setLoadOpen(true), 0)}>
                <FolderOpen className="size-3.5 mr-2" /> Load workflow
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/studio" className="flex items-center">
                  <ArrowRight className="size-3.5 mr-2" /> Go to Studio
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
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
      <div className="flex-1 relative z-0">
        <HeyGenTplCtx.Provider value={auroraTemplates}>
        <ComfyCtx.Provider value={comfyTemplates}>
        <HandlersCtx.Provider value={handlers}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{
              animated: true,
              style: {
                stroke: "rgba(255,255,255,0.55)",
                strokeWidth: 1.5,
                strokeDasharray: "6 4",
                filter: "drop-shadow(0 0 2px rgba(255,255,255,0.3))",
              },
            }}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="oklch(0.70 0.32 325 / 0.28)" />
            <Controls position="bottom-right" className="!bottom-16 !bg-[oklch(0.13_0.04_290/0.8)] !border-white/10 [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-foreground" />
          </ReactFlow>
        </HandlersCtx.Provider>
        </ComfyCtx.Provider>
        </HeyGenTplCtx.Provider>
        <BatchOutputViewer
          nodeId={batchViewerNodeId}
          nodes={nodes}
          onClose={() => setBatchViewerNodeId(null)}
          onUpdate={update}
          onCancel={() => collectionRunnerRef.current?.cancel()}
          onPause={() => { collectionRunnerRef.current?.pause(); setBatchPaused(true); }}
          onResume={() => { collectionRunnerRef.current?.resume(); setBatchPaused(false); }}
          isPaused={batchPaused}
        />
        {/* Floating glass toolbar — templates + finished-work gallery live over the canvas */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-[oklch(0.13_0.04_290/0.85)] backdrop-blur-xl shadow-lg p-1.5">
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
          <FinishedWorkflowsGallery
            directLoad
            onLoad={(id) => {
              const g = getTemplateById(id) ?? defaultGraphFor(id);
              if (g) {
                setNodes(g.nodes);
                setEdges(g.edges);
                setCoachTplName(g.name);
                setLastTemplateGraph(g);
                setMarketplaceTemplateId(null);
                toast.success(`Loaded "${g.name}"`);
              } else {
                toast.error(`Couldn't load "${id}" — template not found`);
              }
            }}
          />
        </div>
        {/* Quick-start coach mark — appears after loading a template */}
        {coachTplName && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 max-w-xl w-[calc(100%-1.5rem)] rounded-xl border border-primary/30 bg-[oklch(0.15_0.05_290/0.95)] backdrop-blur-xl shadow-[0_0_30px_oklch(0.78_0.18_305/0.4)] p-3 animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-lg grid place-items-center text-white shrink-0" style={{ background: "var(--gradient-hero)" }}>
                <Sparkles className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{coachTplName} loaded</div>
                <ol className="mt-1 text-sm text-white/80 space-y-0.5 list-decimal list-inside">
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
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2 py-2 rounded-full border border-white/10 bg-[oklch(0.13_0.04_290/0.92)] backdrop-blur-xl shadow-[0_0_30px_oklch(0.78_0.18_305/0.5)] animate-fade-in max-w-[calc(100%-1rem)] overflow-x-auto">
          <button onClick={() => addNode("input")} className="size-9 shrink-0 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="Image"><ImageIcon className="size-4" /></button>
          <button onClick={() => addNode("audio")} className="size-9 shrink-0 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="Audio"><Music className="size-4" /></button>
          <button onClick={() => addNode("image")} className="size-9 shrink-0 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="Image gen"><Wand2 className="size-4" /></button>
          <button onClick={() => addNode("video")} className="size-9 shrink-0 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="Video"><Film className="size-4" /></button>
          <button onClick={() => addNode("lipsync")} className="size-9 shrink-0 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="Lip sync"><Mic className="size-4" /></button>
          <button onClick={() => addNode("comfy")} className="size-9 shrink-0 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="ComfyUI"><Boxes className="size-4" /></button>
          <button onClick={() => addNode("batchVideo")} className="size-9 shrink-0 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="Batch video"><Layers className="size-4" /></button>
          <button onClick={() => addNode("heygenTemplate")} className="size-9 shrink-0 rounded-full grid place-items-center text-white/80 hover:text-white hover:bg-white/10" title="HeyGen Template"><Sparkles className="size-4" /></button>
          <button
            onClick={() => {
              if (graphWarnings.length) { toast.error(graphWarnings[0]); return; }
              runMut.mutate();
            }}
            disabled={runMut.isPending}
            title={graphWarnings.length ? graphWarnings[0] : undefined}
            className="ml-1 h-9 px-4 shrink-0 rounded-full text-primary-foreground text-sm font-medium inline-flex items-center gap-1.5 shadow-[0_0_24px_oklch(0.78_0.18_305/0.8)] disabled:opacity-60"
            style={{ background: "var(--gradient-hero)" }}
          >
            {runMut.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Run
          </button>
        </div>
      </div>

      {/* Docked, collapsible session asset gallery — rendered at the top level so its
          fixed toggle/panel isn't trapped under the header by the canvas area's z-0 stacking context */}
      <GeneratedAssetGallery />

      <AuroraAgentPanel
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        onSendToCanvas={(g) => { setNodes(g.nodes); setEdges(g.edges); setMarketplaceTemplateId(null); }}
      />
    </main>
  );
}
