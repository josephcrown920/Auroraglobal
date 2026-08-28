// Pannable/zoomable Canvas workspace — the heart of Adult School's node-based
// workflow. Every card is one creative step; dashed lines show lineage.
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useReactFlow,
  addEdge,
  type Connection,
  type OnConnectEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { ArrowLeft, MousePointer2, Plus, Redo2, Sparkles, Undo2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { ShotNode } from "./ShotNode";
import { AddStepPopover, type AddStepValue } from "./AddStepPopover";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { runGenerate } from "@/lib/generate-api";
import { getModel, LOOKS } from "@/lib/models";
import type { ShotNode as ShotNodeType, CanvasEdge, MediaKind, GenKind } from "./types";
import { buildExampleWorkflow } from "./exampleWorkflow";

const nodeTypes = { shot: ShotNode };

const TABS: { id: GenKind | "canvas" | "motion"; label: string; disabled?: boolean }[] = [
  { id: "canvas", label: "Canvas" },
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
  { id: "motion", label: "Motion Control", disabled: true },
  { id: "upscale", label: "Upscale" },
];

interface Props {
  user: User;
  onBack: () => void;
  onOpenConnect: () => void;
  tourTargetRef?: (el: HTMLElement | null) => void;
}

function CanvasInner({ user, onBack, onOpenConnect }: Props) {
  const { screenToFlowPosition } = useReactFlow<ShotNodeType, CanvasEdge>();
  const [nodes, setNodes] = useState<ShotNodeType[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [history, setHistory] = useState<{ nodes: ShotNodeType[]; edges: CanvasEdge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: ShotNodeType[]; edges: CanvasEdge[] }[]>([]);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("canvas");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [popover, setPopover] = useState<{
    x: number; y: number; flowX: number; flowY: number; kind: MediaKind; parentId?: string; modelId?: string;
  } | null>(null);
  const pendingConnection = useRef<{ nodeId: string } | null>(null);
  const seeded = useRef(false);

  // "Latest ref" indirection for the seeded example nodes: their onBranch/
  // onRegenerate/onMakeVideo closures are captured ONCE at seed time, but
  // regenerate/openPopoverForNode below close over `nodes`/`edges` as of
  // whichever render defined them. Without this indirection the seeded
  // closures would freeze on the very first render's `nodes` (still `[]`
  // before setNodes(example.nodes) commits), so every action would silently
  // no-op forever. Refreshing these refs every render keeps them current.
  const regenerateRef = useRef<(nodeId: string) => void>(() => {});
  const openPopoverForNodeRef = useRef<(nodeId: string, kind: MediaKind) => void>(() => {});
  // regenerate/openPopoverForNode are hoisted function declarations below —
  // safe to reference here since only invoked later, via the refs, on click.
  regenerateRef.current = regenerate;
  openPopoverForNodeRef.current = openPopoverForNode;

  if (!seeded.current) {
    seeded.current = true;
    const example = buildExampleWorkflow({
      onBranch: (nid) => openPopoverForNodeRef.current(nid, "image"),
      onRegenerate: (nid) => regenerateRef.current(nid),
      onMakeVideo: (nid) => openPopoverForNodeRef.current(nid, "video"),
    });
    setNodes(example.nodes);
    setEdges(example.edges);
  }

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-19), { nodes, edges }]);
    setFuture([]);
  }, [nodes, edges]);

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [{ nodes, edges }, ...f]);
      setNodes(prev.nodes);
      setEdges(prev.edges);
      return h.slice(0, -1);
    });
  }
  function redo() {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h, { nodes, edges }]);
      setNodes(next.nodes);
      setEdges(next.edges);
      return f.slice(1);
    });
  }

  const applyNodeUpdate = useCallback((id: string, patch: Partial<ShotNodeType["data"]>) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }, []);

  const runStep = useCallback(
    async (nodeId: string, value: AddStepValue, parentUrl?: string) => {
      const model = getModel(value.modelId)!;
      const look = LOOKS.find((l) => l.id === value.lookId) ?? LOOKS[0];
      const extra = value.prompt.trim() ? ` Additional details: ${value.prompt.trim()}.` : "";
      const identityRefs = parentUrl ? [parentUrl] : model.photos;
      const prompt =
        value.kind === "video"
          ? `${look.prompt}${extra} Subtle cinematic camera motion, natural movement.`
          : `Use the uploaded face photo as strict identity reference — keep facial likeness, skin tone, and hairstyle EXACTLY the same. ${look.prompt}${extra} Hyper-realistic photography, ultra-HD 8K, lifelike skin texture, physically accurate lighting, no CGI.`;
      try {
        const outcome = await runGenerate({
          kind: value.kind,
          prompt,
          imageUrls: identityRefs,
          editStrict: value.kind === "image",
          historyModelId: value.modelId,
          historyLookId: value.lookId,
        });
        applyNodeUpdate(nodeId, { status: "done", mediaUrl: outcome.url, mediaType: value.kind === "video" ? "video" : "image" });
      } catch (e) {
        applyNodeUpdate(nodeId, { status: "failed", error: e instanceof Error ? e.message : "Failed" });
        toast.error(e instanceof Error ? e.message : "Generation failed");
      }
    },
    [applyNodeUpdate],
  );

  const createNode = useCallback(
    (flowX: number, flowY: number, value: AddStepValue, parentId?: string) => {
      pushHistory();
      const id = `shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const model = getModel(value.modelId)!;
      const look = LOOKS.find((l) => l.id === value.lookId) ?? LOOKS[0];
      const parentUrl = parentId ? nodes.find((n) => n.id === parentId)?.data.mediaUrl ?? undefined : undefined;
      const node: ShotNodeType = {
        id,
        type: "shot",
        position: { x: flowX, y: flowY },
        data: {
          label: `${model.name} · ${look.label}`,
          mediaUrl: null,
          mediaType: value.kind === "video" ? "video" : "image",
          status: "generating",
          prompt: value.prompt,
          modelId: value.modelId,
          lookId: value.lookId,
          onBranch: (nid) => openPopoverForNode(nid, "image"),
          onRegenerate: (nid) => regenerate(nid),
          onMakeVideo: (nid) => openPopoverForNode(nid, "video"),
        },
      };
      setNodes((prev) => [...prev, node]);
      if (parentId) {
        setEdges((prev) => [
          ...prev,
          { id: `e-${parentId}-${id}`, source: parentId, target: id, animated: true, style: { strokeDasharray: "4 4", stroke: "#e11d6a55" } },
        ]);
      }
      void runStep(id, value, parentUrl);
      return id;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, pushHistory, runStep],
  );

  function regenerate(nodeId: string) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    pushHistory();
    applyNodeUpdate(nodeId, { status: "generating" });
    const parentEdge = edges.find((e) => e.target === nodeId);
    const parentUrl = parentEdge ? nodes.find((n) => n.id === parentEdge.source)?.data.mediaUrl ?? undefined : undefined;
    void runStep(nodeId, {
      modelId: node.data.modelId,
      lookId: (node.data.lookId as AddStepValue["lookId"]) ?? "boudoir",
      prompt: node.data.prompt,
      kind: node.data.mediaType,
    }, parentUrl);
  }

  function openPopoverForNode(nodeId: string, kind: MediaKind) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    setPopover({
      x: 260, y: 120, flowX: node.position.x + 200, flowY: node.position.y,
      kind, parentId: nodeId, modelId: node.data.modelId,
    });
  }

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true }, eds)), []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (connectionState.isValid) return; // dropped on a real handle — normal edge
      const fromNode = connectionState.fromNode;
      if (!fromNode) return;
      const point = "changedTouches" in event ? event.changedTouches[0] : event;
      const flowPos = screenToFlowPosition({ x: point.clientX, y: point.clientY });
      setPopover({
        x: point.clientX - 260 < 0 ? 16 : point.clientX - 260,
        y: Math.max(16, point.clientY - 340),
        flowX: flowPos.x, flowY: flowPos.y,
        kind: "image", parentId: fromNode.id, modelId: nodes.find((n) => n.id === fromNode.id)?.data.modelId,
      });
    },
    [screenToFlowPosition, nodes],
  );

  function openToolbarAdd() {
    const kind = activeTab === "video" || activeTab === "upscale" || activeTab === "image" ? (activeTab as MediaKind) : "image";
    setPopover({ x: 90, y: 100, flowX: 40, flowY: 40 + nodes.length * 20, kind });
  }

  const onAssistantResult = useCallback(
    (result: { nodeId: string; kind: MediaKind }) => {
      // Assistant already inserted the node itself via createNode; nothing else to do here.
      void result;
    },
    [],
  );

  return (
    <div className="relative flex h-screen w-full flex-col bg-[#050207] text-white" onClick={() => setPopover(null)}>
      {/* Top bar */}
      <header className="z-20 flex shrink-0 items-center justify-between border-b border-white/8 bg-[#0a050d]/90 px-4 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/50 hover:text-white">
            <ArrowLeft size={11} />
          </button>
          <Sparkles size={13} className="text-rose-400" />
          <span className="text-[13px] font-bold">Example workflow</span>
        </div>
        <nav className="hidden items-center gap-1 rounded-full border border-white/8 bg-white/[0.02] p-1 sm:flex" data-tour="canvas-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              disabled={t.disabled}
              onClick={() => setActiveTab(t.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                t.disabled
                  ? "cursor-not-allowed text-white/20"
                  : activeTab === t.id
                    ? "bg-white text-black"
                    : "text-white/50 hover:text-white"
              }`}
            >
              {t.label}{t.disabled ? " · Soon" : ""}
            </button>
          ))}
        </nav>
        <button
          data-tour="assistant-button"
          onClick={() => setAssistantOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-[0_0_16px_rgba(217,70,239,0.4)]"
        >
          <Sparkles size={11} /> Assistant
        </button>
      </header>

      {/* Left vertical toolbar */}
      <div className="pointer-events-none absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-white/8 bg-[#0a050d]/90 p-1.5 backdrop-blur-xl" data-tour="add-step-toolbar">
        <button title="Select" className="pointer-events-auto flex size-8 items-center justify-center rounded-xl bg-white/10 text-white">
          <MousePointer2 size={14} />
        </button>
        <button
          title="Add step"
          onClick={(e) => { e.stopPropagation(); openToolbarAdd(); }}
          className="pointer-events-auto flex size-8 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white"
        >
          <Plus size={14} />
        </button>
        <div className="my-0.5 h-px bg-white/10" />
        <button
          title="Undo"
          onClick={(e) => { e.stopPropagation(); undo(); }}
          disabled={history.length === 0}
          className="pointer-events-auto flex size-8 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-25"
        >
          <Undo2 size={14} />
        </button>
        <button
          title="Redo"
          onClick={(e) => { e.stopPropagation(); redo(); }}
          disabled={future.length === 0}
          className="pointer-events-auto flex size-8 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-25"
        >
          <Redo2 size={14} />
        </button>
      </div>

      {/* Canvas */}
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={(changes) => setNodes((nds) => applyNodeChangesLocal(changes, nds))}
          onEdgesChange={(changes) => setEdges((eds) => applyEdgeChangesLocal(changes, eds))}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onPaneClick={() => setPopover(null)}
          colorMode="dark"
          fitView
          minZoom={0.15}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#ffffff14" />
          <Controls showInteractive={false} className="!bg-[#0a050d] !border-white/10 [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-white" />
          <MiniMap pannable zoomable className="!bg-[#0a050d] !border !border-white/10" maskColor="#00000090" nodeColor="#e11d6a" />
        </ReactFlow>

        {popover && (
          <AddStepPopover
            x={popover.x}
            y={popover.y}
            defaultKind={popover.kind}
            defaultModelId={popover.modelId}
            onClose={() => setPopover(null)}
            onConfirm={(v) => {
              createNode(popover.flowX, popover.flowY, v, popover.parentId);
              setPopover(null);
            }}
          />
        )}
      </div>

      <AssistantPanel
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        nodes={nodes}
        onCreateNode={createNode}
        onOpenConnect={onOpenConnect}
        onResult={onAssistantResult}
      />
    </div>
  );
}

// Minimal local reimplementation of @xyflow/react's applyNodeChanges/applyEdgeChanges
// to avoid an extra import surface; covers position/select/remove which is all this
// workspace needs.
function applyNodeChangesLocal(changes: import("@xyflow/react").NodeChange<ShotNodeType>[], nodes: ShotNodeType[]): ShotNodeType[] {
  let next = nodes;
  for (const c of changes) {
    if (c.type === "position" && c.position) {
      next = next.map((n) => (n.id === c.id ? { ...n, position: c.position! } : n));
    } else if (c.type === "select") {
      next = next.map((n) => (n.id === c.id ? { ...n, selected: c.selected } : n));
    } else if (c.type === "remove") {
      next = next.filter((n) => n.id !== c.id);
    }
  }
  return next;
}
function applyEdgeChangesLocal(changes: import("@xyflow/react").EdgeChange<CanvasEdge>[], edges: CanvasEdge[]): CanvasEdge[] {
  let next = edges;
  for (const c of changes) {
    if (c.type === "select") next = next.map((e) => (e.id === c.id ? { ...e, selected: c.selected } : e));
    else if (c.type === "remove") next = next.filter((e) => e.id !== c.id);
  }
  return next;
}

export function CanvasWorkspace(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
