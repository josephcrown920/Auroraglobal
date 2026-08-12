import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Clapperboard,
  CreditCard,
  Images,
  Layers,
  LineChart,
  Mic,
  Music,
  Palette,
  Plus,
  Settings,
  Sparkles,
  Users,
  Wand2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { HiddenBadge, useFeatureVisibility } from "@/components/FeatureVisibilityProvider";
import { featureKeyForRoute } from "@/lib/feature-visibility";

/** Only live, working Aurora routes may appear in the sheet. */
type ToolPath =
  | "/studio"
  | "/colors"
  | "/scene-builder"
  | "/motion"
  | "/music-video"
  | "/spin"
  | "/lipsync"
  | "/gallery"
  | "/creator/dashboard"
  | "/billing"
  | "/settings"
  | "/partners";

type Tool = {
  label: string;
  to: ToolPath;
  icon: LucideIcon;
  badge?: string;
  dot?: boolean;
};

/**
 * Every tile below maps to a LIVE Aurora route (mirrors MobileNav's live
 * feature lists). Archived/coming-soon tools are deliberately absent — the
 * sheet must never advertise something the app can't do yet.
 */
const SECTIONS: { title: string; tools: Tool[] }[] = [
  {
    title: "Studio",
    tools: [
      { label: "Image & Video Studio", to: "/studio", icon: Sparkles, dot: true },
      { label: "Colors Studio", to: "/colors", icon: Palette },
      { label: "Directors ROOM", to: "/scene-builder", icon: Layers, badge: "New", dot: true },
      { label: "Motion Control", to: "/motion", icon: Wand2, dot: true },
      { label: "Lyric Video", to: "/music-video", icon: Music },
    ],
  },
  {
    title: "Content",
    tools: [
      { label: "TikTok30", to: "/spin", icon: Clapperboard, dot: true },
      { label: "Lip Sync", to: "/lipsync", icon: Mic },
    ],
  },
  {
    title: "Account",
    tools: [
      { label: "Gallery", to: "/gallery", icon: Images },
      { label: "Creator Hub", to: "/creator/dashboard", icon: LineChart },
      { label: "Plan & Billing", to: "/billing", icon: CreditCard },
      { label: "Settings", to: "/settings", icon: Settings },
      { label: "Earn Free Aura", to: "/partners", icon: Users, dot: true },
    ],
  },
];

function ToolTile({ tool, onClose, hiddenBadge }: { tool: Tool; onClose: () => void; hiddenBadge?: boolean }) {
  const Icon = tool.icon;
  return (
    <Link
      to={tool.to}
      onClick={onClose}
      className="flex flex-col items-center gap-2 text-center no-underline"
    >
      <span className="relative flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-card shadow-[var(--shadow-card)]">
        <Icon className="size-7 text-foreground" strokeWidth={1.6} aria-hidden="true" />
        {tool.badge ? (
          <span className="absolute -top-2 right-1 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
            {tool.badge}
          </span>
        ) : null}
      </span>
      <span className="flex items-start justify-center gap-1 text-[13px] font-medium leading-tight text-foreground">
        {tool.dot ? <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-dot" /> : null}
        {tool.label}
        <HiddenBadge show={!!hiddenBadge} />
      </span>
    </Link>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AuroraToolsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { showFeature, isHiddenFromUsers } = useFeatureVisibility();
  const containerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  // Full modal keyboard contract: initial focus on open, Tab cycle trapped
  // inside the sheet, Escape closes, focus returns to the trigger on close.
  useEffect(() => {
    if (!open) return;
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && root.contains(active);
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="aurora-tools-title"
      className="fixed inset-0 z-[80] flex flex-col"
      style={{ background: "var(--gradient-sheet)" }}
    >
      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pb-2 pt-6">
          <h2 id="aurora-tools-title" className="text-[26px] font-extrabold tracking-tight text-foreground">
            All tools
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close tools">
            <X className="size-7 text-foreground" strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-40">
          {SECTIONS.map((section) => {
            const tools = section.tools.filter((tool) => showFeature(featureKeyForRoute(tool.to)));
            if (tools.length === 0) return null;
            return (
              <section key={section.title} className="mt-7">
                <h3 className="mb-3 text-lg font-bold text-foreground">{section.title}</h3>
                <div className="grid grid-cols-4 gap-x-3 gap-y-5">
                  {tools.map((tool) => (
                    <ToolTile
                      key={`${section.title}-${tool.label}`}
                      tool={tool}
                      onClose={onClose}
                      hiddenBadge={isHiddenFromUsers(featureKeyForRoute(tool.to))}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 pb-8">
          <div className="mx-auto w-full max-w-[520px]">
            <Link
              to="/studio"
              onClick={onClose}
              className="pointer-events-auto flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-bold text-primary-foreground no-underline"
              style={{ background: "var(--gradient-cta)" }}
            >
              <Plus className="size-6 rounded-md bg-foreground/85 p-0.5 text-card" strokeWidth={3} />
              New project
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
