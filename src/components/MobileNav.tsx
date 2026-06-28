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
  type LucideIcon,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

type Feature = { to: string; label: string; icon: LucideIcon };

// Full feature list shown in the slide-out drawer (order = drawer order).
const FEATURES: Feature[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/studio", label: "Studio", icon: Sparkles },
  { to: "/canvas", label: "Canvas", icon: Workflow },
  { to: "/ugc", label: "UGC Ads", icon: Megaphone },
  { to: "/colors", label: "Colors", icon: Palette },
  { to: "/motion", label: "Motion", icon: Film },
  { to: "/lipsync", label: "Lip Sync", icon: Mic },
  { to: "/clips", label: "Clips", icon: Scissors },
  { to: "/spin", label: "Spin", icon: Flame },
  { to: "/split-reality", label: "Split Reality", icon: SplitSquareHorizontal },
  { to: "/tiktok", label: "TikTok", icon: Music2 },
  { to: "/workflows", label: "Workflows", icon: LayoutTemplate },
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
      {isCanvas ? (
        // Canvas is a full-screen editor with its own bottom dock — a persistent
        // tab bar would collide, so give it a compact menu pill instead.
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Open navigation menu"
          className="fixed left-3 top-3 z-[60] flex items-center gap-1.5 rounded-full border border-border bg-background/90 px-3 py-2 text-xs font-medium text-foreground shadow-md backdrop-blur md:hidden"
        >
          <Menu className="size-4" />
          Menu
        </button>
      ) : (
        <>
          {/* In-flow spacer so the fixed bar never covers the last bit of content. */}
          <div
            aria-hidden
            className="md:hidden"
            style={{ height: "calc(4rem + env(safe-area-inset-bottom))" }}
          />
          <nav
            aria-label="Primary"
            className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <ul className="grid grid-cols-5">
              {TAB_ITEMS.map((t) => {
                const active = isActive(pathname, t.to);
                return (
                  <li key={t.to}>
                    <Link
                      to={t.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium no-underline transition-colors",
                        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <t.icon className="size-5" />
                      <span>{t.label}</span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  className={cn(
                    "flex h-16 w-full flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                    moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Menu className="size-5" />
                  <span>More</span>
                </button>
              </li>
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
          className="flex w-[18rem] flex-col gap-0 p-0 md:hidden"
        >
          <SheetHeader className="border-b border-border p-4 text-left">
            <SheetTitle className="flex items-center gap-2">
              <img src={auroraLogo.url} alt="" className="size-7 rounded-lg object-contain" />
              <span className="font-semibold tracking-tight">Aurora Studio</span>
            </SheetTitle>
          </SheetHeader>
          <nav aria-label="All features" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {FEATURES.map((f) => {
              const active = isActive(pathname, f.to);
              return (
                <Link
                  key={f.to}
                  to={f.to}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm no-underline transition-colors",
                    active
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <f.icon className="size-5 shrink-0" />
                  <span>{f.label}</span>
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
