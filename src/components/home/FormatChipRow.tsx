import { Link } from "@tanstack/react-router";
import { Palette, Film, Mic, Music2, Flame } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Format = {
  icon: LucideIcon;
  label: string;
  credits: number;
  to: string;
  iconColor: string;
  iconBg: string;
};

const FORMATS: Format[] = [
  {
    icon: Palette,
    label: "Colors",
    credits: 2,
    to: "/colors",
    iconColor: "#818cf8",
    iconBg: "rgba(129,140,248,0.14)",
  },
  {
    icon: Film,
    label: "Motion",
    credits: 10,
    to: "/motion",
    iconColor: "#c084fc",
    iconBg: "rgba(192,132,252,0.14)",
  },
  {
    icon: Mic,
    label: "Lip Sync",
    credits: 8,
    to: "/lipsync",
    iconColor: "#f472b6",
    iconBg: "rgba(244,114,182,0.14)",
  },
  {
    icon: Music2,
    label: "Music Video",
    credits: 12,
    to: "/music-video",
    iconColor: "#34d399",
    iconBg: "rgba(52,211,153,0.14)",
  },
  {
    icon: Flame,
    label: "TikTok UGC",
    credits: 6,
    to: "/spin",
    iconColor: "#fb923c",
    iconBg: "rgba(251,146,60,0.14)",
  },
];

export function FormatChipRow() {
  return (
    <div className="pb-6">
      <p
        className="aurora-kicker mb-3 px-5"
        style={{ color: "oklch(0.58 0.22 25 / 0.6)" }}
      >
        Suggested Formats
      </p>

      {/* Horizontal scroll — hide scrollbar */}
      <div
        className="flex gap-2.5 overflow-x-auto px-5 pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}
      >
        {FORMATS.map((f) => (
          <Link
            key={f.to}
            to={f.to}
            className="group flex shrink-0 items-center gap-2.5 rounded-2xl px-3.5 py-3 no-underline transition-all active:scale-[0.96]"
            style={{
              background: "oklch(0.11 0.015 272)",
              border: "1px solid oklch(1 0 0 / 0.08)",
            }}
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: f.iconBg, color: f.iconColor }}
            >
              <f.icon className="size-[17px]" />
            </span>

            <span className="flex flex-col gap-0.5">
              <span className="whitespace-nowrap text-[13px] font-semibold leading-none text-foreground/90">
                {f.label}
              </span>
              <span className="text-[11px] leading-none text-muted-foreground/50">
                {f.credits} Aura
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
