import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { chainOrder, useBoard, uid, type Board, type Edge, type ShotNode } from "@/lib/board-store";
import { exportBoardZip } from "@/lib/export-zip";
import { FlowCanvas } from "./FlowCanvas";
import { Inspector } from "./Inspector";
import { Timeline } from "./Timeline";
import { CharactersPanel } from "./CharactersPanel";
import { DirectorChat } from "./DirectorChat";
import { WorkersPanel } from "./WorkersPanel";
import { DirectorRoomRail, type DirectorRoomPanel } from "./DirectorRoomRail";
import { MoodboardPanel } from "./MoodboardPanel";

type Tab = "canvas" | "characters" | "gpu";

const PANEL_CONTEXT: Partial<Record<DirectorRoomPanel, { eyebrow: string; title: string; description: string }>> = {
  scenes: {
    eyebrow: "Scene builder",
    title: "Block each moment",
    description: "Arrange shots, connect the sequence, and see the full production beat by beat.",
  },
  layers: {
    eyebrow: "Layers",
    title: "Build the shot stack",
    description: "Use the production canvas to organize subject, environment, performance, and finishing details.",
  },
  storyboard: {
    eyebrow: "Storyboard",
    title: "Turn the plan into a cut",
    description: "Review your visual sequence across the canvas, timeline, and selected frame inspector.",
  },
  flows: {
    eyebrow: "Flows",
    title: "Map the production flow",
    description: "Connect every scene and hand-off so the edit has a clear path from idea to final cut.",
  },
};

function PanelHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="border-b border-border/60 bg-card/30 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="mt-1 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
    </header>
  );
}

function ScenesPanel({ board, onSelect }: { board: Board; onSelect: (id: string) => void }) {
  const scenes = Array.from(new Set(board.shots.map((shot) => shot.scene))).map((scene) => {
    const shots = board.shots.filter((shot) => shot.scene === scene);
    return { scene, shots, duration: shots.reduce((total, shot) => total + Number(shot.duration || 0), 0) };
  });

  return (
    <section className="min-h-0 flex-1 overflow-auto bg-background">
      <PanelHeader
        eyebrow="Scene builder"
        title="Block each moment"
        description="Group the board into production-ready scenes, then jump into the first shot to shape the sequence."
      />
      <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
        {scenes.map(({ scene, shots, duration }) => (
          <article key={scene} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="aspect-[16/9] overflow-hidden bg-muted">
              {shots[0]?.imageUrl ? (
                <img src={shots[0].imageUrl} alt={`${scene} scene reference`} className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-xs text-muted-foreground">No scene frame yet</div>
              )}
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-foreground">{scene}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {shots.length} shot{shots.length === 1 ? "" : "s"} · {duration.toFixed(1)}s
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Scene
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {shots.slice(0, 4).map((shot) => (
                  <button
                    key={shot.id}
                    type="button"
                    onClick={() => onSelect(shot.id)}
                    className="max-w-full truncate rounded-md border border-border px-2 py-1 text-left text-[11px] text-muted-foreground hover:border-primary/60 hover:text-foreground"
                  >
                    {shot.title}
                  </button>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function LayersPanel({
  board,
  selected,
  onSelect,
}: {
  board: Board;
  selected: ShotNode | null;
  onSelect: (id: string) => void;
}) {
  const [visible, setVisible] = useState<Record<string, boolean>>({
    performance: true,
    wardrobe: true,
    environment: true,
    finish: true,
  });
  const activeShot = selected ?? board.shots[0] ?? null;
  const layers = activeShot
    ? [
        { id: "performance", label: "Performance", value: activeShot.title, tone: "bg-primary/20" },
        { id: "wardrobe", label: "Wardrobe", value: activeShot.wardrobe || "Add a wardrobe direction", tone: "bg-amber-400/20" },
        { id: "environment", label: "Environment", value: activeShot.frame || "Add a camera or location cue", tone: "bg-cyan-400/20" },
        { id: "finish", label: "Finish", value: activeShot.mood || "Add a mood and lighting cue", tone: "bg-fuchsia-400/20" },
      ]
    : [];

  return (
    <section className="min-h-0 flex-1 overflow-auto bg-background">
      <PanelHeader
        eyebrow="Layers"
        title="Build the shot stack"
        description="Toggle the creative layers that make the selected shot coherent before it moves into the final cut."
      />
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-2">
          {layers.map((layer, index) => (
            <div key={layer.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-sm font-semibold ${layer.tone}`}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{layer.label}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{layer.value}</p>
              </div>
              <button
                type="button"
                aria-pressed={visible[layer.id]}
                onClick={() => setVisible((current) => ({ ...current, [layer.id]: !current[layer.id] }))}
                className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:border-primary/60 hover:text-foreground"
              >
                {visible[layer.id] ? "Visible" : "Hidden"}
              </button>
            </div>
          ))}
        </div>
        <aside className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Select a shot</p>
          <div className="mt-3 space-y-1.5">
            {chainOrder(board).map((shot, index) => (
              <button
                key={shot.id}
                type="button"
                onClick={() => onSelect(shot.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs ${
                  activeShot?.id === shot.id ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <span className="text-[10px] tabular-nums opacity-60">{String(index + 1).padStart(2, "0")}</span>
                <span className="truncate">{shot.title}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function FlowsPanel({ board, onSelect }: { board: Board; onSelect: (id: string) => void }) {
  const byId = new Map(board.shots.map((shot) => [shot.id, shot]));
  const flowSteps = board.edges.flatMap((edge, index) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    return from && to ? [{ edge, index, from, to }] : [];
  });

  return (
    <section className="min-h-0 flex-1 overflow-auto bg-background">
      <PanelHeader
        eyebrow="Flows"
        title="Map the production flow"
        description="Trace every hand-off from one shot to the next and open a node when the sequence needs a change."
      />
      <div className="space-y-3 p-5">
        {flowSteps.map(({ edge, index, from, to }) => (
          <div key={edge.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-xs font-semibold text-primary">
              {String(index + 1).padStart(2, "0")}
            </span>
            <button type="button" onClick={() => onSelect(from.id)} className="min-w-0 flex-1 text-left hover:text-primary">
              <span className="block truncate text-sm font-medium text-foreground">{from.title}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{from.scene} · source node</span>
            </button>
            <span aria-hidden className="text-muted-foreground">→</span>
            <button type="button" onClick={() => onSelect(to.id)} className="min-w-0 flex-1 text-left hover:text-primary">
              <span className="block truncate text-sm font-medium text-foreground">{to.title}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{to.scene} · destination</span>
            </button>
          </div>
        ))}
        {flowSteps.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Connect two shots on the storyboard canvas to create the first flow.
          </div>
        )}
      </div>
    </section>
  );
}

export function StudioPage() {
  const { board, setBoard, updateShot, addShot, removeShot, connect, disconnect, reset } =
    useBoard();
  const [tab, setTab] = useState<Tab>("canvas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [activeRoomPanel, setActiveRoomPanel] = useState<DirectorRoomPanel>("scenes");

  useEffect(() => {
    if (isMobile) setChatOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const selections: Record<string, { panel: DirectorRoomPanel; tab: Tab }> = {
      wardrobe: { panel: "wardrobe", tab: "characters" },
      scenes: { panel: "scenes", tab: "canvas" },
      layers: { panel: "layers", tab: "canvas" },
      storyboard: { panel: "storyboard", tab: "canvas" },
      moodboard: { panel: "moodboard", tab: "canvas" },
      flows: { panel: "flows", tab: "canvas" },
    };
    const selectHashPanel = () => {
      const selection = selections[window.location.hash.slice(1)];
      if (selection) {
        setActiveRoomPanel(selection.panel);
        setTab(selection.tab);
      }
    };

    selectHashPanel();
    window.addEventListener("hashchange", selectHashPanel);
    return () => window.removeEventListener("hashchange", selectHashPanel);
  }, []);

  useEffect(() => {
    if (board && !selectedId && board.shots.length) setSelectedId(chainOrder(board)[0].id);
  }, [board, selectedId]);

  const handleRoomPanelChange = (panel: DirectorRoomPanel, nextTab: Tab) => {
    if (typeof window !== "undefined" && window.location.hash !== `#${panel}`) {
      window.location.hash = panel;
    }
    setActiveRoomPanel(panel);
    setTab(nextTab);
  };

  if (!board) {
    if (activeRoomPanel === "moodboard") {
      return (
        <div className="director-room-workspace h-screen bg-background text-foreground">
          <DirectorRoomRail
            activePanel={activeRoomPanel}
            onPanelChange={handleRoomPanelChange}
          />
          <MoodboardPanel />
        </div>
      );
    }

    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
        Loading your studio…
      </div>
    );
  }

  const selected = board.shots.find((s) => s.id === selectedId) ?? null;
  const panelContext = PANEL_CONTEXT[activeRoomPanel];

  function rechain(dragId: string, dropId: string) {
    setBoard((b) => {
      const order = chainOrder(b).map((s) => s.id);
      const from = order.indexOf(dragId);
      const to = order.indexOf(dropId);
      if (from < 0 || to < 0) return b;
      order.splice(to, 0, ...order.splice(from, 1));
      const edges: Edge[] = order
        .slice(0, -1)
        .map((id, i) => ({ id: uid(), from: id, to: order[i + 1] }));
      const byId = new Map(b.shots.map((s) => [s.id, s]));
      const shots = b.shots.map((s) => {
        const idx = order.indexOf(s.id);
        const node = byId.get(s.id)!;
        return { ...node, x: 60 + (idx % 4) * 320, y: 60 + Math.floor(idx / 4) * 300 };
      });
      return { ...b, edges, shots };
    });
  }

  async function doExport() {
    if (!board) return;
    setExporting(true);
    setExportNotice(null);
    try {
      const result = await exportBoardZip(board);
      setExportNotice(
        result.missing.length
          ? `Exported with ${result.missing.length} unavailable asset${
              result.missing.length === 1 ? "" : "s"
            }: ${result.missing.slice(0, 2).join(", ")}${result.missing.length > 2 ? "…" : ""}`
          : "Export downloaded with all available media.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <header className="border-b border-border/60 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="text-xs uppercase tracking-[0.2em] text-accent shrink-0">
            Director's Room
          </Link>
          <input
            value={board.title}
            onChange={(e) => setBoard((b) => ({ ...b, title: e.target.value }))}
            className="bg-transparent text-base font-semibold outline-none min-w-0 truncate"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <TabBtn active={tab === "canvas"} onClick={() => handleRoomPanelChange("storyboard", "canvas")}>
            Canvas
          </TabBtn>
          <TabBtn active={tab === "characters"} onClick={() => handleRoomPanelChange("wardrobe", "characters")}>
            Characters
          </TabBtn>
          <TabBtn active={tab === "gpu"} onClick={() => setTab("gpu")}>
            GPU
          </TabBtn>
          <button
            onClick={() => setChatOpen((v) => !v)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
          >
            {chatOpen ? "Hide director" : "Director"}
          </button>
          <button
            onClick={doExport}
            disabled={exporting}
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-60"
          >
            {exporting ? "Zipping…" : "Export ZIP"}
          </button>
          <button
            onClick={() => {
              if (confirm("Reset the board to the demo storyboard?")) reset();
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        </div>
      </header>
      {exportNotice && (
        <div className="border-b border-border/60 bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          {exportNotice}
        </div>
      )}

      <div className="director-room-workspace flex-1 min-h-0">
        <DirectorRoomRail
          activePanel={tab === "gpu" ? null : activeRoomPanel}
          onPanelChange={handleRoomPanelChange}
        />
        <div
          className="min-h-0 min-w-0 grid relative"
          style={{ gridTemplateColumns: chatOpen && !isMobile ? "1fr 340px" : "1fr" }}
        >
        <div className="flex flex-col min-h-0 min-w-0">
          {tab === "gpu" ? (
            <WorkersPanel board={board} />
          ) : activeRoomPanel === "moodboard" ? (
            <MoodboardPanel />
          ) : activeRoomPanel === "scenes" ? (
            <ScenesPanel board={board} onSelect={setSelectedId} />
          ) : activeRoomPanel === "layers" ? (
            <LayersPanel board={board} selected={selected} onSelect={setSelectedId} />
          ) : activeRoomPanel === "flows" ? (
            <FlowsPanel board={board} onSelect={setSelectedId} />
          ) : tab === "canvas" ? (
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_340px]">
              <div className="flex flex-col min-h-0 min-w-0">
                {panelContext && (
                  <section className="shrink-0 border-b border-border/60 bg-card/30 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                      {panelContext.eyebrow}
                    </p>
                    <h2 className="mt-1 text-sm font-semibold text-foreground">{panelContext.title}</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{panelContext.description}</p>
                  </section>
                )}
                <FlowCanvas
                  board={board}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    if (isMobile) setInspectorOpen(true);
                  }}
                  onMove={(id, x, y) => updateShot(id, { x, y })}
                  onConnect={connect}
                  onDisconnect={disconnect}
                  onAdd={() => {
                    setSelectedId(addShot());
                    if (isMobile) setInspectorOpen(true);
                  }}
                  onAddVideo={() => {
                    setSelectedId(
                      addShot({
                        kind: "video",
                        title: "Video agent",
                        scene: "Verse",
                        videoModel: "seedance-2.5",
                      }),
                    );
                    if (isMobile) setInspectorOpen(true);
                  }}
                />
                <Timeline
                  board={board}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id);
                    if (isMobile) setInspectorOpen(true);
                  }}
                  onReorder={rechain}
                />
              </div>
              {isMobile && inspectorOpen && (
                <button
                  aria-label="Close inspector"
                  onClick={() => setInspectorOpen(false)}
                  className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
                />
              )}
              <aside
                className={
                  "border-l border-border/60 overflow-auto min-h-0 bg-background " +
                  (isMobile
                    ? "fixed inset-y-0 right-0 z-50 w-[88%] max-w-[360px] shadow-2xl transition-transform duration-200 " +
                      (inspectorOpen ? "translate-x-0" : "translate-x-full pointer-events-none")
                    : "")
                }
              >
                {isMobile && (
                  <div className="sticky top-0 z-10 flex justify-end bg-background/95 px-3 py-2 backdrop-blur">
                    <button
                      onClick={() => setInspectorOpen(false)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
                    >
                      Close
                    </button>
                  </div>
                )}
                {selected ? (
                  <Inspector
                    shot={selected}
                    board={board}
                    onChange={(patch) => updateShot(selected.id, patch)}
                    onDelete={() => {
                      removeShot(selected.id);
                      setSelectedId(null);
                      setInspectorOpen(false);
                    }}
                  />
                ) : (
                  <div className="p-6 text-sm text-muted-foreground">
                    Select a shot node to edit it.
                  </div>
                )}
              </aside>
            </div>
          ) : tab === "characters" ? (
            <CharactersPanel
              board={board}
              onChange={(characters) => setBoard((b) => ({ ...b, characters }))}
            />
          ) : null}
        </div>

        {chatOpen && (
          <>
            {isMobile && (
              <button
                aria-label="Close director"
                onClick={() => setChatOpen(false)}
                className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm md:hidden"
              />
            )}
            <aside
              className={
                "border-l border-border/60 min-h-0 bg-background " +
                (isMobile
                  ? "fixed inset-y-0 right-0 z-50 w-[92%] max-w-[380px] shadow-2xl flex flex-col"
                  : "")
              }
            >
              {isMobile && (
                <div className="flex justify-end px-3 py-2 border-b border-border/60">
                  <button
                    onClick={() => setChatOpen(false)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
                  >
                    Close
                  </button>
                </div>
              )}
              <div className="flex-1 min-h-0">
                <DirectorChat
                  board={board}
                  onAccept={(patch) => {
                    const id = addShot(patch);
                    setSelectedId(id);
                    handleRoomPanelChange("storyboard", "canvas");
                    if (isMobile) setChatOpen(false);
                  }}
                />
              </div>
            </aside>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        "rounded-md px-3 py-1.5 text-xs font-medium transition " +
        (active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-accent hover:text-accent-foreground")
      }
    >
      {children}
    </button>
  );
}
