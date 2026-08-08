import { useCallback, useEffect, useRef, useState } from "react";
import type { Board, ShotNode } from "@/lib/board-store";

const NODE_W = 260;
const NODE_H = 210;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function FlowCanvas({
  board,
  selectedId,
  onSelect,
  onMove,
  onConnect,
  onDisconnect,
  onAdd,
  onAddVideo,
}: {
  board: Board;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onConnect: (from: string, to: string) => void;
  onDisconnect: (edgeId: string) => void;
  onAdd: () => void;
  onAddVideo: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [linking, setLinking] = useState<{ from: string; x: number; y: number } | null>(null);
  const [view, setView] = useState({ zoom: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  const localPoint = useCallback((e: { clientX: number; clientY: number }) => {
    const el = wrapRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const { zoom, tx, ty } = viewRef.current;
    return { x: (e.clientX - r.left - tx) / zoom, y: (e.clientY - r.top - ty) / zoom };
  }, []);

  // Non-passive wheel listener so we can preventDefault (React's onWheel is passive).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setView((v) => {
        const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
        const next = clamp(v.zoom * Math.exp(-dy * 0.0015), MIN_ZOOM, MAX_ZOOM);
        const k = next / v.zoom;
        return { zoom: next, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function zoomAtCenter(factor: number) {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = r.width / 2;
    const py = r.height / 2;
    setView((v) => {
      const next = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const k = next / v.zoom;
      return { zoom: next, tx: px - (px - v.tx) * k, ty: py - (py - v.ty) * k };
    });
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = localPoint(e);
    if (dragRef.current) {
      onMove(
        dragRef.current.id,
        Math.max(0, p.x - dragRef.current.dx),
        Math.max(0, p.y - dragRef.current.dy),
      );
    } else if (panRef.current) {
      const start = panRef.current;
      setView((v) => ({ ...v, tx: start.tx + (e.clientX - start.x), ty: start.ty + (e.clientY - start.y) }));
    } else if (linking) {
      setLinking({ ...linking, x: p.x, y: p.y });
    }
  }

  function endLinkOn(id: string) {
    if (linking && linking.from !== id) onConnect(linking.from, id);
    setLinking(null);
  }

  const width = Math.max(1200, ...board.shots.map((s) => s.x + NODE_W + 200));
  const height = Math.max(700, ...board.shots.map((s) => s.y + NODE_H + 200));

  return (
    <div
      ref={wrapRef}
      onPointerMove={onPointerMove}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).dataset["pan"] === "1") {
          panRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
        }
      }}
      onPointerUp={() => {
        dragRef.current = null;
        panRef.current = null;
        setLinking(null);
      }}
      onPointerLeave={() => {
        dragRef.current = null;
        panRef.current = null;
      }}
      className="relative flex-1 overflow-hidden touch-none bg-[radial-gradient(circle_at_1px_1px,var(--border)_1px,transparent_0)] [background-size:24px_24px]"
    >
      <div
        data-pan="1"
        className="relative origin-top-left"
        style={{
          width,
          height,
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.zoom})`,
        }}
      >
        <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
              <path d="M0,0 L0,6 L9,3 z" fill="var(--primary)" />
            </marker>
          </defs>
          {board.edges.map((edge) => {
            const a = board.shots.find((s) => s.id === edge.from);
            const b = board.shots.find((s) => s.id === edge.to);
            if (!a || !b) return null;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const mid = (x1 + x2) / 2;
            return (
              <g key={edge.id} className="pointer-events-auto">
                <path
                  d={`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="none"
                  markerEnd="url(#arrow)"
                  opacity={0.75}
                />
                <circle
                  cx={(x1 + x2) / 2}
                  cy={(y1 + y2) / 2}
                  r={9}
                  className="fill-card stroke-border cursor-pointer"
                  onClick={() => onDisconnect(edge.id)}
                />
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 + 4}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px] cursor-pointer select-none"
                  onClick={() => onDisconnect(edge.id)}
                >
                  ×
                </text>
              </g>
            );
          })}
          {linking &&
            (() => {
              const a = board.shots.find((s) => s.id === linking.from);
              if (!a) return null;
              return (
                <path
                  d={`M ${a.x + NODE_W} ${a.y + NODE_H / 2} L ${linking.x} ${linking.y}`}
                  stroke="var(--accent)"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  fill="none"
                />
              );
            })()}
        </svg>

        {board.shots.map((shot, i) => (
          <NodeCard
            key={shot.id}
            shot={shot}
            index={i}
            selected={selectedId === shot.id}
            onSelect={() => onSelect(shot.id)}
            onDragStart={(e) => {
              const p = localPoint(e);
              dragRef.current = { id: shot.id, dx: p.x - shot.x, dy: p.y - shot.y };
              onSelect(shot.id);
            }}
            onStartLink={(e) => {
              const p = localPoint(e);
              setLinking({ from: shot.id, x: p.x, y: p.y });
            }}
            onEndLink={() => endLinkOn(shot.id)}
          />
        ))}
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-lg border border-border bg-card/90 backdrop-blur px-1 py-1 text-xs">
        <button onClick={() => zoomAtCenter(1 / 1.2)} className="px-2 py-1" aria-label="Zoom out">
          −
        </button>
        <span className="w-12 text-center tabular-nums text-muted-foreground">
          {Math.round(view.zoom * 100)}%
        </span>
        <button onClick={() => zoomAtCenter(1.2)} className="px-2 py-1" aria-label="Zoom in">
          +
        </button>
        <button
          onClick={() => setView({ zoom: 1, tx: 0, ty: 0 })}
          className="px-2 py-1 text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={onAddVideo}
          className="rounded-full border border-accent bg-card text-accent px-4 h-10 text-xs font-medium shadow-lg"
        >
          + Video agent
        </button>
        <button
          onClick={onAdd}
          className="rounded-full bg-primary text-primary-foreground h-12 w-12 text-xl shadow-lg self-end"
          aria-label="Add shot node"
        >
          +
        </button>
      </div>
    </div>
  );
}

function NodeCard({
  shot,
  index,
  selected,
  onSelect,
  onDragStart,
  onStartLink,
  onEndLink,
}: {
  shot: ShotNode;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onStartLink: (e: React.PointerEvent) => void;
  onEndLink: () => void;
}) {
  return (
    <div
      onPointerUp={onEndLink}
      onClick={onSelect}
      style={{ left: shot.x, top: shot.y, width: NODE_W, height: NODE_H }}
      className={
        "absolute rounded-xl border bg-card overflow-hidden select-none transition-shadow " +
        (selected
          ? "border-primary ring-2 ring-primary/40 shadow-xl"
          : shot.kind === "video"
            ? "border-accent/60 hover:border-accent"
            : "border-border hover:border-primary/50")
      }
    >
      <div
        onPointerDown={onDragStart}
        className="flex items-center justify-between px-3 py-2 border-b border-border/60 cursor-grab active:cursor-grabbing bg-muted/30"
      >
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {shot.kind === "video" ? "Video agent" : `${String(index + 1).padStart(2, "0")} · ${shot.scene}`}
        </span>
        <span className="text-[10px] text-muted-foreground">{shot.duration}s</span>
      </div>
      <div className="h-[96px] bg-muted/40 grid place-items-center overflow-hidden">
        {shot.imageUrl ? (
          <img
            src={shot.imageUrl}
            alt={shot.title}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="text-[11px] text-muted-foreground">
            {shot.kind === "video" ? shot.videoModel : "No frame yet"}
          </span>
        )}
      </div>
      <div className="px-3 py-2 space-y-1">
        <div className="text-sm font-medium truncate">{shot.title}</div>
        <div className="text-[10px] leading-snug text-muted-foreground line-clamp-3">
          {(shot.kind === "video" ? shot.videoPrompt : shot.prompt) ||
            shot.mood ||
            shot.shotType ||
            "No prompt yet — open the inspector to write one."}
        </div>
      </div>

      <div className="absolute -left-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-primary bg-background" />
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartLink(e);
        }}
        title="Drag to chain into the next shot"
        className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-primary bg-primary cursor-crosshair"
      />
    </div>
  );
}
