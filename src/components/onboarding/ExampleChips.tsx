import { cn } from "@/lib/utils";
import type { ToolPreset } from "@/lib/example-presets";

type Props = {
  presets: ToolPreset[];
  onSelect: (preset: ToolPreset) => void;
  activeId?: string;
  label?: string;
  className?: string;
};

export function ExampleChips({ presets, onSelect, activeId, label = "Try an example:", className }: Props) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-xs text-white/50 font-medium uppercase tracking-widest">{label}</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset)}
            title={preset.hint}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all",
              "hover:border-primary/60 hover:bg-primary/10 hover:text-primary",
              activeId === preset.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-white/10 bg-white/5 text-white/70",
            )}
          >
            <span>{preset.emoji}</span>
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
