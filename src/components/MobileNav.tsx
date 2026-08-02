import { Link, useRouterState } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Sparkles,
  Images,
  Menu,
  Palette,
  Film,
  Mic,
  Flame,
  Music2,
  Users,
  TrendingUp,
  Sun,
  Moon,
  Clapperboard,
  UserCircle2,
  CreditCard,
  Wand2,
  Workflow,
  Megaphone,
  Brush,
  Shield,
  Layers,
  Camera,
  LayoutGrid,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { useTheme } from "@/lib/theme-context";
import { WhatsNew } from "@/components/WhatsNew";

type Feature = {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  previewImg?: string;
};

// ── Five destinations ─────────────────────────────────────────────────────────
// Specialist tools remain available as modes from these destinations, but they
// no longer compete with Create, Studio, Content, Gallery, and Account.
const DESTINATIONS: Feature[] = [
  { to: "/home", label: "Create", icon: Sparkles },
  { to: "/studio", label: "Studio", icon: Palette },
  { to: "/content", label: "Content", icon: LayoutGrid },
  { to: "/gallery", label: "Gallery", icon: Images },
  { to: "/account", label: "Account", icon: UserRound },
];

// ── Live studio tools — visible to all users ──────────────────────────────
const STUDIO_FEATURES: Feature[] = [
  { to: "/studio",        label: "Image & Video Studio", icon: Sparkles,    previewImg: "/nav-previews/studio.jpg" },
  { to: "/colors",        label: "Colors Studio",        icon: Palette,     previewImg: "/nav-previews/colors.jpg" },
  { to: "/scene-builder", label: "Directors ROOM",       icon: Layers,      previewImg: "/nav-previews/scene-builder.jpg" },
  { to: "/motion",        label: "Motion Control",       icon: Wand2,       previewImg: "/nav-previews/perform-anywhere.jpg" },
  { to: "/music-video",   label: "Lyric Video",          icon: Film,        previewImg: "/nav-previews/music-video.jpg" },
];

// ── Live content tools — visible to all users ─────────────────────────────
const CONTENT_FEATURES: Feature[] = [
  { to: "/spin",    label: "TikTok30", icon: Flame, previewImg: "/nav-previews/spin.jpg" },
  { to: "/lipsync", label: "Lip Sync", icon: Mic,   previewImg: "/nav-previews/lipsync.jpg" },
];

const ACCOUNT_FEATURES: Feature[] = [
  { to: "/gallery", label: "Gallery", icon: Images },
  { to: "/billing", label: "Plan & Billing", icon: CreditCard },
  { to: "/creator/dashboard", label: "Creator Hub", icon: TrendingUp },
  { to: "/settings", label: "Settings", icon: UserRound },
  { to: "/partners", label: "Earn Free Aura", icon: Users },
  { to: "/admin", label: "Admin", icon: Shield },
];

/** Archived — hidden from the main nav; still reachable from /admin.
 *  Add features here when they need more design work before going live. */
export const ARCHIVED_FEATURES: Feature[] = [
  // ── Studio tools (coming soon) ────────────────────────────────────────
  { to: "/photo-edit",      label: "Photo Editor",     icon: Brush },
  { to: "/canvas",          label: "Infinity Canvas",  icon: Workflow },
  { to: "/split-reality",   label: "Split Reality",    icon: Wand2 },
  { to: "/live-studio",     label: "Live Studios",     icon: Music2 },
  { to: "/scene-weaver",    label: "Scene Weaver",     icon: Camera },
  { to: "/storyboard",      label: "Storyboard",       icon: Clapperboard },
  // ── Content tools (coming soon) ──────────────────────────────────────
  { to: "/ugc",             label: "UGC Ads",          icon: Megaphone },
  { to: "/ugc-line",        label: "Content Line",     icon: Layers },
  { to: "/tiktok",          label: "TikTok Studio",    icon: Music2 },
  { to: "/avatar",          label: "Talking Avatars",  icon: UserCircle2 },
  { to: "/content-machine", label: "Content Machine",  icon: LayoutGrid },
  { to: "/video-agent",     label: "Video Agent",      icon: Film },
  // ── Legacy / dev tools ───────────────────────────────────────────────
  { to: "/templates",        label: "Templates",        icon: Layers },
  { to: "/colors-show",      label: "Colors Show Creator", icon: Film },
  { to: "/editor",           label: "Playground",       icon: Sparkles },
  { to: "/heygen-templates", label: "HeyGen Templates", icon: Film },
  { to: "/growth",           label: "Growth Tools",     icon: Sparkles },
  { to: "/guides",           label: "Viral Guides",     icon: Sparkles },
  { to: "/dashboard",        label: "Dashboard",        icon: Sparkles },
  { to: "/marketplace",      label: "Marketplace",      icon: Sparkles },
  { to: "/roadmap",          label: "Roadmap",          icon: Sparkles },
  { to: "/workflows",        label: "Workflows",        icon: Sparkles },
  { to: "/clips",            label: "Clips",            icon: Sparkles },
  { to: "/edit",             label: "AutoCut",          icon: Sparkles },
  { to: "/cli",              label: "CLI",              icon: Sparkles },
  { to: "/gifts",            label: "Gifts",            icon: Sparkles },
  { to: "/nexusarb",         label: "NexusARB (Sim)",   icon: Sparkles },
];

const TAB_ITEMS = DESTINATIONS;

const STUDIO_PATHS = ["/studio", "/colors", "/photo-edit", "/canvas", "/split-reality", "/scene-weaver", "/scene-builder", "/motion", "/storyboard", "/music-video", "/live-studio"];
const CONTENT_PATHS = ["/content", "/ugc", "/ugc-line", "/spin", "/tiktok", "/lipsync", "/avatar", "/content-machine", "/video-agent"];
const ACCOUNT_PATHS = ["/account", "/gallery", "/billing", "/creator/dashboard", "/settings", "/partners", "/admin"];

function destinationIsActive(pathname: string, destination: string) {
  if (destination === "/studio") return STUDIO_PATHS.some((path) => isActive(pathname, path));
  if (destination === "/content") return CONTENT_PATHS.some((path) => isActive(pathname, path));
  if (destination === "/account") return ACCOUNT_PATHS.some((path) => isActive(pathname, path));
  return isActive(pathname, destination);
}

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
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm no-underline transition-all duration-150",
        active
          ? "bg-[image:var(--gradient-hero)] text-white shadow-[var(--shadow-glow-soft)]"
          : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors",
          active ? "bg-white/20" : "aurora-glass group-hover:bg-accent/50",
        )}
      >
        <f.icon className="size-3.5" />
      </span>
      <span className="font-medium flex-1 min-w-0">{f.label}</span>

      {/* Preview thumbnail — only for features with a previewImg */}
      {f.previewImg && (
        <span
          className="shrink-0 overflow-hidden rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ width: 38, height: 27, border: "1px solid oklch(0.60 0.27 295 / 0.25)" }}
        >
          <img
            src={f.previewImg}
            alt=""
            aria-hidden
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center", display: "block" }}
          />
        </span>
      )}
    </Link>
  );
}


export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const { theme, toggle } = useTheme();

  const isCanvas  = isActive(pathname, "/canvas");
  const isLanding = pathname === "/";

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
      <style>{`
        @keyframes tab-breathe {
          0%, 100% { opacity: 0.55; transform: scaleX(0.7); }
          50%       { opacity: 1;    transform: scaleX(1);   }
        }
        @keyframes tab-glow-breathe {
          0%, 100% { box-shadow: 0 0 10px -4px oklch(0.60 0.27 295 / 0.4); }
          50%       { box-shadow: 0 0 22px -4px oklch(0.60 0.27 295 / 0.75); }
        }
        .tab-breathe-bar {
          animation: tab-breathe 3s ease-in-out infinite;
        }
        .tab-active-glow {
          animation: tab-glow-breathe 3s ease-in-out infinite;
        }
      `}</style>

      <aside className="aurora-desktop-rail" aria-label="Primary navigation">
        <Link to="/home" className="aurora-rail-brand" aria-label="Aurora Create">
          <span className="aurora-rail-mark" aria-hidden />
          <span className="aurora-rail-wordmark">Aurora</span>
        </Link>
        <nav className="aurora-rail-links">
          {TAB_ITEMS.map((item) => {
            const active = destinationIsActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn("aurora-rail-link", active && "is-active")}
              >
                <item.icon className="size-[18px]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="aurora-rail-footer">
          <button
            type="button"
            onClick={toggle}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="aurora-rail-icon"
          >
            {theme === "dark" ? <Moon className="size-[17px]" /> : <Sun className="size-[17px]" />}
          </button>
          <button type="button" onClick={() => setOpen(true)} aria-label="Open all tools" className="aurora-rail-icon">
            <Menu className="size-[17px]" />
          </button>
        </div>
      </aside>

      {isCanvas && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Open navigation menu"
          className="phone-edge-left fixed top-3 z-[60] flex items-center gap-1.5 rounded-full aurora-glass-strong px-3.5 py-2 text-xs font-medium shadow-[var(--shadow-soft)] transition-[filter,color] hover:brightness-110 text-foreground"
        >
          <Menu className="size-4" />
          Menu
        </button>
      )}

      {!isCanvas && !isLanding && (
        <>
          <div aria-hidden style={{ height: "calc(4rem + env(safe-area-inset-bottom))" }} />
            <nav
            aria-label="Primary"
              className="aurora-bottom-nav phone-fixed-x fixed bottom-0 z-50 border-t border-border"
            style={{
              paddingBottom: "env(safe-area-inset-bottom)",
              background: "oklch(0.085 0.022 272 / 0.92)",
              backdropFilter: "blur(24px) saturate(1.6)",
              WebkitBackdropFilter: "blur(24px) saturate(1.6)",
              borderTop: "1px solid oklch(0.60 0.27 295 / 0.15)",
              boxShadow: "0 -1px 40px -12px oklch(0.60 0.27 295 / 0.2), 0 -1px 0 oklch(1 0 0 / 0.06) inset",
            }}
          >
            {/* Top accent line */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent 0%, oklch(0.60 0.27 295 / 0.5) 50%, transparent 100%)" }}
            />

            <ul className="grid grid-cols-5">
              {TAB_ITEMS.map((t) => {
                const active = destinationIsActive(pathname, t.to);
                const isCreate = t.to === "/home";
                return (
                  <li key={t.to}>
                    <Link
                      to={t.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold no-underline transition-colors duration-200",
                        active
                          ? "text-primary"
                          : isCreate
                          ? "text-primary/60 hover:text-primary"
                          : "text-muted-foreground/70 hover:text-foreground",
                      )}
                      style={active ? { textShadow: "0 0 12px oklch(0.60 0.27 295 / 0.6)" } : undefined}
                    >
                      {/* Breathing indicator bar */}
                      {active && (
                        <span
                          aria-hidden
                          className="tab-breathe-bar absolute top-0 h-[2px] w-10 rounded-full"
                          style={{ background: "linear-gradient(90deg, oklch(0.60 0.27 295), oklch(0.72 0.22 315))" }}
                        />
                      )}

                      {/* Icon wrapper — Create tab always shows tinted pill */}
                      <span
                        className={cn(
                          "relative flex items-center justify-center rounded-xl transition-all duration-300",
                          active
                            ? "tab-active-glow size-9 bg-[oklch(0.60_0.27_295/0.15)] ring-1 ring-[oklch(0.60_0.27_295/0.25)]"
                            : isCreate
                            ? "size-9 bg-[oklch(0.60_0.27_295/0.09)] ring-1 ring-[oklch(0.60_0.27_295/0.18)]"
                            : "size-8",
                        )}
                      >
                        <t.icon
                          className={cn(
                            "transition-all duration-200",
                            active ? "size-[18px]" : isCreate ? "size-[17px]" : "size-5",
                          )}
                        />
                      </span>

                      <span className="tracking-wide truncate max-w-[72px] text-center">{t.label}</span>
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
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[image:var(--gradient-hero)] opacity-60"
            />
            <SheetTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/25">
                  <span className="inline-block size-3 rounded-full bg-primary" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-serif italic text-base font-semibold text-foreground">Aurora</span>
                  <span className="text-[11px] text-muted-foreground font-normal">AI Creative Studio</span>
                </span>
              </div>
              <WhatsNew />
            </SheetTitle>
          </SheetHeader>

          {/* ── Nav body ────────────────────────────────────────────────── */}
          <nav aria-label="All features" className="relative flex flex-1 flex-col gap-3 overflow-y-auto p-3 pb-4">

            <NavSection label="Studio modes">
              {STUDIO_FEATURES.map((f) => (
                <LiveNavItem key={f.to} f={f} active={isActive(pathname, f.to)} onClick={() => setOpen(false)} />
              ))}
            </NavSection>

            <NavSection label="Content modes">
              {CONTENT_FEATURES.map((f) => (
                <LiveNavItem key={f.to} f={f} active={isActive(pathname, f.to)} onClick={() => setOpen(false)} />
              ))}
            </NavSection>

            <NavSection label="Account">
              {ACCOUNT_FEATURES.map((f) => (
                <LiveNavItem key={f.to} f={f} active={isActive(pathname, f.to)} onClick={() => setOpen(false)} />
              ))}
            </NavSection>
          </nav>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="relative shrink-0 border-t border-border p-3 flex flex-col gap-1">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
            />

            <button
              type="button"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
            >
              <span className="flex items-center gap-3">
                {theme === "dark" ? <Moon className="size-4 shrink-0" /> : <Sun className="size-4 shrink-0" />}
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
