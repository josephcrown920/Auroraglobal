import { chainOrder, type Board } from "@/lib/board-store";

export function Timeline({
  board,
  selectedId,
  onSelect,
  onReorder,
}: {
  board: Board;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (dragId: string, dropId: string) => void;
}) {
  const order = chainOrder(board);
  const total = order.reduce((a, s) => a + Number(s.duration || 0), 0);

  return (
    <div className="border-t border-border/60 bg-card/40 p-3">
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
        Timeline · {order.length} shots · {total.toFixed(1)}s — drag clips to re-chain
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {order.map((s, i) => (
          <button
            key={s.id}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", s.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dragId = e.dataTransfer.getData("text/plain");
              if (dragId && dragId !== s.id) onReorder(dragId, s.id);
            }}
            onClick={() => onSelect(s.id)}
            style={{ width: Math.max(72, Number(s.duration || 1) * 22) }}
            className={
              "flex-shrink-0 rounded-md border overflow-hidden text-left transition " +
              (selectedId === s.id
                ? "border-primary ring-1 ring-primary/40"
                : "border-border hover:border-primary/50")
            }
          >
            <div className="h-10 bg-muted/60 overflow-hidden">
              {s.imageUrl && (
                <img src={s.imageUrl} alt="" className="w-full h-full object-cover opacity-85" />
              )}
            </div>
            <div className="px-1.5 py-1 text-[10px] truncate">
              <span className="text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>{" "}
              {s.title}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
