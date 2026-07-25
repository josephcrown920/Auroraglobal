import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";

export type HeyGenStyle = {
  id: string;
  label: string;
  description: string;
  /** Palette preview swatches (CSS color strings) */
  colors: [string, string, string];
  /** HeyGen template ID this style maps to */
  templateId?: string;
};

export const HEYGEN_STYLES: readonly HeyGenStyle[] = [
  {
    id: "cinematic-dark",
    label: "Cinematic Dark",
    description: "Deep navy background, dramatic side light, film-grade color",
    colors: ["#0d1526", "#1e3a5f", "#7c4dff"],
    templateId: "heygen_cinematic_dark_01",
  },
  {
    id: "bright-studio",
    label: "Bright Studio",
    description: "Clean white studio, even ring light, professional presenter feel",
    colors: ["#ffffff", "#f3f4f6", "#6366f1"],
    templateId: "heygen_bright_studio_01",
  },
  {
    id: "neon-club",
    label: "Neon Club",
    description: "Hot pink and cyan neon wash, nightclub ambient energy",
    colors: ["#0f0f1a", "#ff2d78", "#00e5ff"],
    templateId: "heygen_neon_club_01",
  },
  {
    id: "golden-warm",
    label: "Golden Warm",
    description: "Warm amber key light, earthy tones, Instagram-native vibe",
    colors: ["#1a1200", "#c8860a", "#ffd166"],
    templateId: "heygen_golden_warm_01",
  },
  {
    id: "urban-street",
    label: "Urban Street",
    description: "Gritty street backdrop, cool blue-gray tones, grounded energy",
    colors: ["#1c1c24", "#3a3a52", "#64748b"],
    templateId: "heygen_urban_street_01",
  },
  {
    id: "editorial-white",
    label: "Editorial White",
    description: "Magazine-cover backdrop, high-contrast B&W conversion with subtle tint",
    colors: ["#f8f8f8", "#d4d4d4", "#1a1a1a"],
    templateId: "heygen_editorial_white_01",
  },
];

type Props = {
  selectedId?: string | null;
  onSelect?: (style: HeyGenStyle) => void;
  className?: string;
};

export function HeyGenStyleTiles({ selectedId, onSelect, className }: Props) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}>
      {HEYGEN_STYLES.map((style) => {
        const isSelected = selectedId === style.id;
        return (
          <button
            key={style.id}
            onClick={() => onSelect?.(style)}
            className={cn(
              "group relative text-left rounded-2xl border p-3 transition-all",
              isSelected
                ? "border-primary/50 bg-primary/8 shadow-[0_0_16px_-4px_oklch(0.72_0.2_300_/_0.3)]"
                : "border-border hover:border-primary/30 hover:bg-white/4",
            )}
          >
            {isSelected && (
              <CheckCircle2 className="absolute top-2.5 right-2.5 size-3.5 text-primary" />
            )}

            {/* Color swatches */}
            <div className="flex gap-1 mb-2.5">
              {style.colors.map((color, i) => (
                <div
                  key={i}
                  className="h-6 flex-1 rounded-md"
                  style={{ background: color }}
                />
              ))}
            </div>

            <p className="text-xs font-semibold mb-0.5">{style.label}</p>
            <p className="text-[10px] text-muted-foreground leading-snug">{style.description}</p>
          </button>
        );
      })}
    </div>
  );
}
