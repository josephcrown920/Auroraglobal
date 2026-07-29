import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Loader2,
  Sparkles,
  Palette,
  Film,
  Music2,
  Layers,
  Brush,
  Workflow,
  Mic,
  Megaphone,
  Flame,
  Wand2,
  Clapperboard,
  UserCircle2,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { listGenerations } from "@/lib/studio.functions";
import { getMyProfile } from "@/lib/billing.functions";

import { HomeTopBar } from "@/components/home/HomeTopBar";
import { ComposerHero } from "@/components/home/ComposerHero";
import { ToolSection, type ToolCard } from "@/components/home/ToolSection";
import { RecentProjectsGrid } from "@/components/home/RecentProjectsGrid";
import type { GenItem } from "@/components/home/RecentProjectsGrid";

export const Route = createLazyFileRoute("/home")({ component: HomePage });

// ── Tool data ────────────────────────────────────────────────────────────────

const ARTIST_TOOLS: ToolCard[] = [
  { to: "/agent",         label: "Video Studio",    desc: "Cinematic AI video",      Icon: Film,        cost: "10 Aura", img: "/nav-previews/music-video.jpg" },
  { to: "/colors",        label: "Colors Studio",   desc: "Cyclorama performance",   Icon: Palette,     cost: "1 Aura",  img: "/nav-previews/colors.jpg" },
  { to: "/studio",        label: "Image Gen",       desc: "AI portraits & stills",   Icon: Sparkles,    cost: "2 Aura",  img: "/nav-previews/studio.jpg" },
  { to: "/live-studio",   label: "Live Studio",     desc: "Session photography",     Icon: Music2,      cost: "2 Aura",  img: "/nav-previews/live-studio.jpg" },
  { to: "/scene-builder", label: "Directors ROOM",  desc: "Scene composition",       Icon: Layers,      cost: "4 Aura",  img: "/nav-previews/scene-builder.jpg" },
  { to: "/photo-edit",    label: "Photo Editor",    desc: "AI retouching",           Icon: Brush,       cost: "2 Aura",  img: "/nav-previews/photo-edit.jpg" },
  { to: "/canvas",        label: "Infinity Canvas", desc: "Infinite creative board", Icon: Workflow,    cost: "Free",    img: "/nav-previews/canvas.jpg" },
];

const CREATOR_TOOLS: ToolCard[] = [
  { to: "/lipsync",     label: "Lip Sync",        desc: "Talking performance",  Icon: Mic,          cost: "8 Aura",  img: "/nav-previews/lipsync.jpg" },
  { to: "/ugc-line",    label: "Content Line",    desc: "UGC automation",       Icon: Layers,       cost: "6 Aura",  img: "/nav-previews/ugc-line.jpg" },
  { to: "/ugc",         label: "UGC Ads",         desc: "Ad campaigns",         Icon: Megaphone,    cost: "6 Aura",  img: "/nav-previews/ugc.jpg" },
  { to: "/spin",        label: "TikTok30",        desc: "30-post campaigns",    Icon: Flame,        cost: "15 Aura", img: "/nav-previews/spin.jpg" },
  { to: "/motion",      label: "Perform Anywhere",desc: "Motion transfer",      Icon: Wand2,        cost: "10 Aura", img: "/nav-previews/perform-anywhere.jpg" },
  { to: "/music-video", label: "Lyric Video",     desc: "Animated lyrics",      Icon: Clapperboard, cost: "12 Aura", img: "/nav-previews/music-video.jpg" },
  { to: "/avatar",      label: "Talking Avatars", desc: "AI presenter",         Icon: UserCircle2,  cost: "10 Aura", img: "/nav-previews/avatar.jpg" },
];

// ── Component ────────────────────────────────────────────────────────────────

function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const profileFn = useServerFn(getMyProfile);
  const listFn    = useServerFn(listGenerations);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn:  () => profileFn(),
    enabled:  !!user,
  });

  const { data: hist } = useQuery({
    queryKey: ["gens", user?.id],
    queryFn:  () => listFn(),
    enabled:  !!user,
  });

  const credits       = profile?.credits ?? null;
  const displayName   = profile?.display_name || user?.email?.split("@")[0] || "Creator";
  const avatarInitial = displayName.charAt(0).toUpperCase();

  const succeeded: GenItem[] = (hist?.items ?? []).filter(
    (i) =>
      (i.status === "complete" || i.status === "succeeded") &&
      (i.result_image_url || i.result_video_url),
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center aurora-page-shell">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="aurora-page-shell relative min-h-screen text-foreground">
      <span aria-hidden className="aurora-ambient" />

      {/* Fixed top bar */}
      <HomeTopBar credits={credits} avatarInitial={avatarInitial} />

      {/* Spacer for top bar */}
      <div style={{ height: "3.5rem" }} />

      {/* Scrollable content — bottom clears the tab bar */}
      <div
        className="relative z-10"
        style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        {/* ── Welcome hero ─────────────────────────────── */}
        <section
          style={{
            padding: "20px 20px 14px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Violet gradient wash */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(135deg, oklch(0.13 0.04 300 / 0.70) 0%, transparent 65%)",
              pointerEvents: "none",
            }}
          />
          {/* Ambient glow orb */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -50,
              right: -30,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "oklch(0.58 0.22 25 / 0.09)",
              filter: "blur(50px)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "oklch(0.96 0.01 272)",
                margin: 0,
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
              }}
            >
              Welcome back, {displayName} 👋
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "oklch(0.50 0.01 272)",
                margin: "5px 0 0",
                lineHeight: 1.4,
              }}
            >
              Your AI creative studio — what are we making today?
            </p>
          </div>
        </section>

        {/* ── Composer ─────────────────────────────────── */}
        <ComposerHero />

        {/* ── For Artists ──────────────────────────────── */}
        <ToolSection
          title="For Artists"
          accentColor="oklch(0.72 0.20 300)"
          iconBg="rgba(139, 92, 246, 0.20)"
          iconBorder="rgba(139, 92, 246, 0.38)"
          tools={ARTIST_TOOLS}
        />

        {/* Divider */}
        <div
          aria-hidden
          style={{
            margin: "4px 20px 10px",
            height: 1,
            background: "oklch(1 0 0 / 0.05)",
          }}
        />

        {/* ── For Creators ─────────────────────────────── */}
        <ToolSection
          title="For Creators"
          accentColor="oklch(0.82 0.15 55)"
          iconBg="rgba(251, 191, 36, 0.20)"
          iconBorder="rgba(251, 191, 36, 0.38)"
          tools={CREATOR_TOOLS}
        />

        {/* Divider */}
        <div
          aria-hidden
          style={{
            margin: "4px 20px 14px",
            height: 1,
            background: "oklch(1 0 0 / 0.05)",
          }}
        />

        {/* ── Recent projects ───────────────────────────── */}
        <RecentProjectsGrid items={succeeded} />
      </div>
    </div>
  );
}
