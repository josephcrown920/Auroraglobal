import { memo } from "react";
import { Layers, Download } from "lucide-react";
import type { BatchCollection } from "@/lib/batch/collection";
import { sortedItems } from "@/lib/batch/collection";
import { cn } from "@/lib/utils";

type Props = {
  collection: BatchCollection;
  selected?: boolean;
  onSelect?: (col: BatchCollection) => void;
  className?: string;
};

/**
 * A compact canvas/grid node that displays a batch collection as a tiled
 * image mosaic. Can be embedded in the Canvas workflow or used as a
 * standalone gallery card.
 */
export const BatchCollectionNode = memo(function BatchCollectionNode({
  collection,
  selected,
  onSelect,
  className,
}: Props) {
  const items = sortedItems(collection).slice(0, 9);

  const handleDownloadAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const item of sortedItems(collection)) {
      try {
        const res = await fetch(item.url);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `batch-${collection.id.slice(0, 8)}-${item.index + 1}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise((r) => setTimeout(r, 200));
      } catch {
        // skip failed downloads silently
      }
    }
  };

  return (
    <div
      onClick={() => onSelect?.(collection)}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-[var(--color-panel)] transition-all cursor-pointer",
        selected ? "border-primary shadow-[0_0_20px_-5px_oklch(0.72_0.2_300_/_0.4)]" : "border-border hover:border-primary/40",
        className,
      )}
    >
      {/* Mosaic grid */}
      <div
        className="grid gap-0.5 bg-black/20"
        style={{
          gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`,
          aspectRatio: "1 / 1",
        }}
      >
        {items.map((item) => (
          <img
            key={item.generationId}
            src={item.url}
            alt={`Batch item ${item.index + 1}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ))}
        {items.length === 0 && (
          <div className="col-span-3 flex items-center justify-center text-muted-foreground text-sm">
            No results
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="size-3.5 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{collection.name}</p>
            <p className="text-[10px] text-muted-foreground">{collection.items.length} images</p>
          </div>
        </div>
        <button
          onClick={handleDownloadAll}
          title="Download all"
          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-all"
        >
          <Download className="size-3.5" />
        </button>
      </div>
    </div>
  );
});
