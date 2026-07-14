import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import {
  Crown,
  Lock,
  Sparkles,
  Image as ImageIcon,
  Film,
  Mic2,
  Megaphone,
  Layers,
} from "lucide-react";
import { templateCost, templateFlowLabel, type StudioTemplate } from "@/lib/template-studio";

/** Pick a badge icon from the template's dispatch + orchestrator kinds. */
function flowIcon(t: StudioTemplate) {
  if (t.dispatch === "spin") return Layers;
  if (t.dispatch === "ugc") return Megaphone;
  if (t.kinds.includes("lipsync")) return Mic2;
  if (t.kinds.includes("video")) return Film;
  return ImageIcon;
}

export function TemplateCard({
  template,
  locked,
  onSelect,
  className,
}: {
  template: StudioTemplate;
  locked: boolean;
  onSelect: () => void;
  className?: string;
}) {
  const FlowIcon = flowIcon(template);
  const cost = templateCost(template);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative text-left rounded-2xl overflow-hidden aurora-card aurora-card-hover focus:outline-none aurora-focus-ring ${className ?? ""}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        {template.thumbnailVideo ? (
          <AutoplayVideo
            src={template.thumbnailVideo}
            poster={template.thumbnail}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <img
            src={template.thumbnail}
            alt={template.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

        {/* Cost badge — templateCost() returns 0 only for truly free templates. */}
        {cost > 0 ? (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow-soft)] backdrop-blur">
            <Sparkles className="size-3" /> {cost}
          </span>
        ) : (
          <span className="absolute top-2.5 right-2.5 inline-flex items-center rounded-full bg-emerald-500/90 px-2 py-0.5 text-sm font-semibold text-white shadow-[var(--shadow-glow-soft)] backdrop-blur">
            Free
          </span>
        )}

        {/* Pro badge */}
        {template.premium && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[13px] font-semibold text-primary backdrop-blur">
            {locked ? <Lock className="size-2.5" /> : <Crown className="size-2.5" />} Pro
          </span>
        )}

        {/* Bottom text overlaid on the image */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="flex items-center gap-1.5">
            <FlowIcon className="size-3.5 text-primary" />
            <span className="text-[13px] uppercase tracking-[0.14em] text-white/70">
              {templateFlowLabel(template)}
            </span>
          </div>
          <h3 className="mt-0.5 text-sm font-semibold text-white leading-tight">
            {template.title}
          </h3>
        </div>

        {locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/45 backdrop-blur-[1px]">
            <Lock className="size-5 text-primary" />
            <span className="text-sm font-semibold text-primary">Pro only</span>
          </div>
        )}
      </div>

      {/* Blurb */}
      <div className="p-3">
        <p className="text-xs text-muted-foreground leading-snug line-clamp-2">{template.blurb}</p>
      </div>
    </button>
  );
}
