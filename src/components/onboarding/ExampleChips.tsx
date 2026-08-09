import { cn } from "@/lib/utils";
import type { ToolPreset } from "@/lib/example-presets";

type Props = {
  presets: ToolPreset[];
  onSelect: (preset: ToolPreset) => void;
  activeId?: string;
  label?: string;
  className?: string;
  onGenerate?: () => void;
  /** Disable the Run action (e.g. while another generation is pending). */
  generateDisabled?: boolean;
};

export function ExampleChips({ presets, onSelect, activeId, label = "Try an example:", className, onGenerate, generateDisabled = false }: Props) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-xs text-white/50 font-medium uppercase tracking-widest">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
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
        {onGenerate && activeId && (
          <button
            type="button"
            disabled={generateDisabled}
            onClick={onGenerate}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-primary/60 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all animate-in fade-in duration-200 disabled:opacity-50 disabled:pointer-events-none"
          >
            → Run
          </button>
        )}
      </div>
    </div>
  );
}
