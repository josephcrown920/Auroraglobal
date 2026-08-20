import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useIsMobile } from "@/hooks/use-mobile";
import { chainOrder, useBoard, uid, type Edge } from "@/lib/board-store";
import { exportBoardZip } from "@/lib/export-zip";
import { FlowCanvas } from "./FlowCanvas";
import { Inspector } from "./Inspector";
import { Timeline } from "./Timeline";
import { CharactersPanel } from "./CharactersPanel";
import { DirectorChat } from "./DirectorChat";
import { WorkersPanel } from "./WorkersPanel";

type Tab = "canvas" | "characters" | "gpu";

export function StudioPage({ embedded = false }: { embedded?: boolean }) {
  const { board, setBoard, updateShot, addShot, removeShot, connect, disconnect, reset } =
    useBoard();
  const [tab, setTab] = useState<Tab>("canvas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const [inspectorOpen, setInspectorOpen] = useState(false);

  useEffect(() => {
    if (isMobile) setChatOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (board && !selectedId && board.shots.length) setSelectedId(chainOrder(board)[0].id);
  }, [board, selectedId]);

  if (!board) {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">
        Loading your studio…
      </div>
    );
  }

  const selected = board.shots.find((s) => s.id === selectedId) ?? null;

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
    <div
      className={
        (embedded ? "h-full min-h-0" : "h-screen") +
        " flex flex-col overflow-hidden bg-background text-foreground"
      }
    >
      <header className="border-b border-border/60 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/" className="text-xs uppercase tracking-[0.2em] text-accent shrink-0">
            {embedded ? "Storyboard" : "Director's Room"}
          </Link>
          <input
            value={board.title}
            onChange={(e) => setBoard((b) => ({ ...b, title: e.target.value }))}
            className="bg-transparent text-base font-semibold outline-none min-w-0 truncate"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <TabBtn active={tab === "canvas"} onClick={() => setTab("canvas")}>
            Canvas
          </TabBtn>
          <TabBtn active={tab === "characters"} onClick={() => setTab("characters")}>
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

      <div
        className="flex-1 min-h-0 grid relative"
        style={{ gridTemplateColumns: chatOpen && !isMobile ? "1fr 340px" : "1fr" }}
      >
        <div className="flex flex-col min-h-0 min-w-0">
          {tab === "canvas" ? (
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_340px]">
              <div className="flex flex-col min-h-0 min-w-0">
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
          ) : (
            <WorkersPanel board={board} />
          )}
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
                    setTab("canvas");
                    if (isMobile) setChatOpen(false);
                  }}
                />
              </div>
            </aside>
          </>
        )}
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
