import { Link, useRouterState } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Sparkles,
  Images,
  Menu,
  LayoutDashboard,
  Palette,
  Film,
  Mic,
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
  Clapperboard,
  Code2,
  CreditCard,
  Wand2,
  Bot,
  Workflow,
  Scissors,
  Factory,
  Megaphone,
  Map,
  Lock,
  Sprout,
  Store,
  Brush,
  Shield,
  type LucideIcon,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";
import { useTheme } from "@/lib/theme-context";
import { WhatsNew } from "@/components/WhatsNew";

type Feature = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const LIVE_FEATURES: Feature[] = [
  { to: "/studio",      label: "Image Generation", icon: Sparkles },
  { to: "/photo-edit",  label: "Photo Editor",      icon: Brush },
  { to: "/orchestrate", label: "Video Generation",  icon: Film },
  { to: "/agent",       label: "Video Agent",       icon: Bot },
  { to: "/ugc",         label: "UGC Ads",           icon: Megaphone },
  { to: "/spin",        label: "Spin · 30 Posts",   icon: Flame },
  { to: "/colors",      label: "Colors Studio",     icon: Palette },
  { to: "/motion",      label: "Motion",            icon: Wand2 },
  { to: "/lipsync",     label: "Lip Sync",          icon: Mic },
  { to: "/canvas",      label: "Canvas",            icon: Workflow },
  { to: "/music-video", label: "Lyric Video",       icon: Clapperboard },
  { to: "/growth",      label: "Growth Tools",      icon: Sprout },
  { to: "/editor",      label: "Playground",        icon: Code2 },
];

const UTILITY_FEATURES: Feature[] = [
  { to: "/dashboard",          label: "Dashboard",       icon: LayoutDashboard },
  { to: "/gallery",            label: "Gallery",         icon: Images },
  { to: "/marketplace",        label: "Marketplace",     icon: Store },
  { to: "/creator/dashboard",  label: "Creator Hub",     icon: TrendingUp },
  { to: "/billing",            label: "Plan & Billing",  icon: CreditCard },
  { to: "/roadmap",            label: "Roadmap",         icon: Map },
  { to: "/admin",              label: "Admin",           icon: Shield },
];

const COMING_SOON: Feature[] = [
  { to: "/content-machine", label: "Content Machine", icon: Factory,           badge: "Soon" },
  { to: "/split-reality", label: "Split Reality",    icon: SplitSquareHorizontal, badge: "Soon" },
  { to: "/tiktok",        label: "TikTok Studio",    icon: Music2,             badge: "Soon" },
  { to: "/clips",         label: "Clips",            icon: Scissors,           badge: "Soon" },
  { to: "/edit",          label: "AutoCut",          icon: Wand2,              badge: "Soon" },
  { to: "/workflows",     label: "Workflows",        icon: LayoutTemplate,     badge: "Soon" },
  { to: "/cli",           label: "CLI",              icon: Terminal,           badge: "Soon" },
  { to: "/gifts",         label: "Gifts",            icon: Gift,               badge: "Soon" },
  { to: "/affiliate",     label: "Affiliate",        icon: Users,              badge: "Soon" },
  { to: "/nexusarb",      label: "NexusARB (Sim)",   icon: TrendingUp,         badge: "Soon" },
];

const TAB_ITEMS: Feature[] = [
  { to: "/studio",      label: "Studio", icon: Sparkles },
  { to: "/orchestrate", label: "Video",  icon: Film },
  { to: "/canvas",      label: "Canvas", icon: Workflow },
  { to: "/gallery",     label: "Gallery", icon: Images },
];

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </p>
      {children}
    </div>
  );
}

function LiveNavItem({ f, active, onClick }: { f: Feature; active: boolean; onClick: () => void }) {
  return (
    <Link
      to={f.to}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm no-underline transition-all duration-150",
        active
          ? "bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)]"
          : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-white/20"
            : "aurora-glass group-hover:bg-accent/50",
        )}
      >
        <f.icon className="size-3.5" />
      </span>
      <span className="font-medium">{f.label}</span>
    </Link>
  );
}

function ComingSoonItem({ f }: { f: Feature }) {
  return (
    <div className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm opacity-50 cursor-default select-none">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg aurora-glass">
        <f.icon className="size-3.5 text-muted-foreground" />
      </span>
      <span className="flex-1 text-muted-foreground">{f.label}</span>
      <span className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Lock className="size-2.5" />
        Soon
      </span>
    </div>
  );
}

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const { theme, toggle } = useTheme();

  const allFeatures = [...LIVE_FEATURES, ...UTILITY_FEATURES, ...COMING_SOON];
  const activeFeature = allFeatures.find((f) => isActive(pathname, f.to));

  const isCanvas = isActive(pathname, "/canvas");
  const moreActive = !!activeFeature && !TAB_ITEMS.some((t) => t.to === activeFeature.to);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.touches[0]?.clientX ?? 0) - touchStartX.current;
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
        <>
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
          <span aria-hidden className="aurora-ambient opacity-70" />

          {/* ── Header ──────────────────────────────────────────────────── */}
          <SheetHeader className="relative shrink-0 border-b border-border p-4 text-left">
            {/* subtle gradient bar across top */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[image:var(--gradient-hero)] opacity-60"
            />
            <SheetTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={auroraLogo.url}
                    alt=""
                    className="size-10 rounded-2xl object-contain shadow-[var(--shadow-glow-soft)]"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-0 rounded-2xl ring-1 ring-white/10"
                  />
                </div>
                <span className="flex flex-col leading-tight">
                  <span className="text-base font-bold tracking-tight text-foreground">Aurora</span>
                  <span className="text-[11px] text-muted-foreground font-normal">AI Creative Studio</span>
                </span>
              </div>
              {/* What's New bell — keeps its own sheet so clicking it closes this one first */}
              <WhatsNew />
            </SheetTitle>
          </SheetHeader>

          {/* ── Nav body ────────────────────────────────────────────────── */}
          <nav aria-label="All features" className="relative flex flex-1 flex-col gap-3 overflow-y-auto p-3 pb-4">

            {/* Live section */}
            <NavSection label="Live now">
              {LIVE_FEATURES.map((f) => (
                <LiveNavItem
                  key={f.to}
                  f={f}
                  active={isActive(pathname, f.to)}
                  onClick={() => setOpen(false)}
                />
              ))}
            </NavSection>

            {/* Utility section */}
            <NavSection label="Account">
              {UTILITY_FEATURES.map((f) => (
                <LiveNavItem
                  key={f.to}
                  f={f}
                  active={isActive(pathname, f.to)}
                  onClick={() => setOpen(false)}
                />
              ))}
            </NavSection>

            {/* Divider with label */}
            <div className="flex items-center gap-2 px-1 pt-1">
              <span className="h-px flex-1 bg-border" />
              <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                <Lock className="size-2.5" />
                Coming soon
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>

            {/* Coming soon section */}
            <div className="flex flex-col gap-0.5">
              {COMING_SOON.map((f) => (
                <ComingSoonItem key={f.to} f={f} />
              ))}
            </div>
          </nav>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="relative shrink-0 border-t border-border p-3 flex flex-col gap-1">
            {/* gradient line across top of footer */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
            />

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
            >
              <span className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="size-4 shrink-0" />
                ) : (
                  <Sun className="size-4 shrink-0" />
                )}
                <span className="font-medium">{theme === "dark" ? "Dark mode" : "Light mode"}</span>
              </span>
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
