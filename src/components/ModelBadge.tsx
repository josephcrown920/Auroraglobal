import { getModelMeta } from "@/lib/models";

export function ModelBadge({ model, size = "sm" }: { model?: string | null; size?: "xs" | "sm" | "md" }) {
  const m = getModelMeta(model);
  const Icon = m.icon;
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : size === "md" ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[11px]";
  const iconSize = size === "md" ? "size-3.5" : "size-3";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${m.bg} ${pad}`}>
      <Icon className={`${iconSize} ${m.color}`} />
      <span className="text-foreground/90">{m.short}</span>
    </span>
  );
}