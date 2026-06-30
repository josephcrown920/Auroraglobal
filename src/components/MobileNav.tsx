import { Link, useRouterState } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Sparkles,
  Workflow,
  Megaphone,
  Images,
  Menu,
  LayoutDashboard,
  Palette,
  Film,
  Mic,
  Scissors,
  Flame,
  SplitSquareHorizontal,
  Music2,
  LayoutTemplate,
  Gift,
  Users,
  TrendingUp,
  Terminal,
  BookOpen,
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";
import { useTheme } from "@/lib/theme-context";

type Feature = { to: string; label: string; icon: LucideIcon };

// Full feature list shown in the slide-out drawer (order = drawer order).
const FEATURES: Feature[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/studio", label: "Studio", icon: Sparkles },
  { to: "/canvas", label: "Canvas", icon: Workflow },
  { to: "/ugc", label: "UGC Ads", icon: Megaphone },
  { to: "/kids", label: "Kids Stories", icon: BookOpen },
  { to: "/colors", label: "Colors", icon: Palette },
  { to: "/motion", label: "Motion", icon: Film },
  { to: "/lipsync", label: "Lip Sync", icon: Mic },
  { to: "/clips", label: "Clips", icon: Scissors },
  { to: "/spin", label: "Spin", icon: Flame },
  { to: "/split-reality", label: "Split Reality", icon: SplitSquareHorizontal },
  { to: "/tiktok", label: "TikTok", icon: Music2 },
  { to: "/workflows", label: "Workflows", icon: LayoutTemplate },
  { to: "/cli", label: "CLI", icon: Terminal },
  { to: "/gallery", label: "Gallery", icon: Images },
  { to: "/gifts", label: "Gifts", icon: Gift },
  { to: "/affiliate", label: "Affiliate", icon: Users },
  { to: "/nexusarb", label: "NexusARB (Sim)", icon: TrendingUp },
];

// Top features surfaced as one-tap bottom tabs (the rest live behind "More").
const TAB_ITEMS: Feature[] = [
  { to: "/studio", label: "Studio", icon: Sparkles },
  { to: "/canvas", label: "Canvas", icon: Workflow },
  { to: "/ugc", label: "UGC", icon: Megaphone },
  { to: "/gallery", label: "Gallery", icon: Images },
];

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const { theme, toggle } = useTheme();

  // The active feature (if any) drives tab/"More" highlighting. On the landing page
  // and other non-feature routes there's simply no active feature — the nav still
  // renders, just with nothing highlighted. (NexusARB is suppressed upstream in
  // __root, so it never reaches here.)
  const activeFeature = FEATURES.find((f) => isActive(pathname, f.to));

  const isCanvas = isActive(pathname, "/canvas");
  const moreActive = !!activeFeature && !TAB_ITEMS.some((t) => t.to === activeFeature.to);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.touches[0]?.clientX ?? 0) - touchStartX.current;
    // Swipe toward the left edge to dismiss the left-hand drawer.
    if (dx < -50) {
      setOpen(false);
      touchStartX.current = null;
    }
  };
  const onTouchEnd = () => {
    touchStartX.current = null;
  };

  return (
    <>
      {/* The menu trigger lives at the top-left on every route — the same compact
          pill the canvas editor uses — so the full features drawer is always one
          tap away from the same place (no longer buried in the bottom tab bar). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open navigation menu"
        className={cn(
          "phone-edge-left fixed top-3 z-[60] flex items-center gap-1.5 rounded-full aurora-glass-strong px-3.5 py-2 text-xs font-medium shadow-[var(--shadow-soft)] transition-[filter,color] hover:brightness-110",
          moreActive ? "text-primary" : "text-foreground",
        )}
      >
        <Menu className="size-4" />
        Menu
      </button>

      {!isCanvas && (
        // Canvas is a full-screen editor with its own bottom dock, so it gets the
        // top-left pill only. Every other route keeps the quick-access tab bar —
        // now four one-tap tabs, with the menu moved up to the top-left pill.
        <>
          {/* In-flow spacer so the fixed bar never covers the last bit of content. */}
          <div aria-hidden style={{ height: "calc(4rem + env(safe-area-inset-bottom))" }} />
          <nav
            aria-label="Primary"
            className="phone-fixed-x fixed bottom-0 z-50 border-t border-border bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
            />
            <ul className="grid grid-cols-4">
              {TAB_ITEMS.map((t) => {
                const active = isActive(pathname, t.to);
                return (
                  <li key={t.to}>
                    <Link
                      to={t.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium no-underline transition-colors",
                        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden
                          className="absolute top-0 h-0.5 w-9 rounded-full bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)]"
                        />
                      )}
                      <t.icon className="size-5" />
                      <span>{t.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="phone-drawer-left flex flex-col gap-0 overflow-hidden p-0"
        >
          <span aria-hidden className="aurora-ambient opacity-60" />
          <SheetHeader className="relative border-b border-border p-4 text-left">
            <SheetTitle className="flex items-center gap-2.5">
              <img
                src={auroraLogo.url}
                alt=""
                className="size-8 rounded-xl object-contain shadow-[var(--shadow-glow-soft)]"
              />
              <span className="flex flex-col leading-tight">
                <span className="font-semibold tracking-tight">Aurora Studio</span>
                <span className="aurora-kicker mt-1">All features</span>
              </span>
            </SheetTitle>
          </SheetHeader>
          <nav aria-label="All features" className="relative flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {FEATURES.map((f) => {
              const active = isActive(pathname, f.to);
              return (
                <Link
                  key={f.to}
                  to={f.to}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm no-underline transition-colors",
                    active
                      ? "aurora-glass-strong font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[image:var(--gradient-hero)]"
                    />
                  )}
                  <f.icon className={cn("size-5 shrink-0", active && "text-primary")} />
                  <span>{f.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* ── Theme toggle ─────────────────────────────────────────────── */}
          <div className="relative border-t border-border p-3">
            <button
              type="button"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
            >
              <span className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="size-5 shrink-0" />
                ) : (
                  <Sun className="size-5 shrink-0" />
                )}
                <span>{theme === "dark" ? "Dark mode" : "Light mode"}</span>
              </span>
              {/* pill toggle */}
              <span
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200",
                  theme === "light" ? "bg-primary" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
                    theme === "light" ? "translate-x-[18px]" : "translate-x-[3px]",
                  )}
                />
              </span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
