import { createLazyFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  ArrowUp,
  X,
  Camera,
  Star,
  Music,
  Droplets,
  Video,
  Aperture,
  Pen,
  Mic2,
  Clapperboard,
  Palette,
  Film,
  Layers,
  Sparkles,
  ScanFace,
  Disc3,
  Shirt,
  Wand2,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { listGenerations } from "@/lib/studio.functions";
import { getMyProfile, setMyPersona } from "@/lib/billing.functions";
import { HomeTopBar } from "@/components/home/HomeTopBar";
import { EditableCopy } from "@/components/EditableCopy";
import { useSiteCopyValue } from "@/components/landing/SiteCopyProvider";

export const Route = createLazyFileRoute("/home")({ component: HomePage });

// ── The two sides of the studio ───────────────────────────────────────────────
// Aurora serves two very different people. Artists make press shots, music
// videos and live visuals; creators make UGC ads, short-form and talking
// avatars. The side chosen at signup (profiles.persona) decides which one opens
// first — the flip tabs let anyone cross over without changing that default.
type SideId = "artist" | "creator";

interface Preset {
  id: string;
  label: string;
  Icon: LucideIcon;
  prompt: string;
  to: string;
}
interface Tool {
  label: string;
  to: string;
  Icon: LucideIcon;
}
interface Inspiration {
  id: string;
  label: string;
  tag: string;
  gradient: string;
  Icon: LucideIcon;
  presetId: string;
}
interface Side {
  id: SideId;
  label: string;
  tab: string;
  blurb: string;
  presets: Preset[];
  tools: Tool[];
  inspirations: Inspiration[];
}

const SIDES: Record<SideId, Side> = {
  artist: {
    id: "artist",
    label: "Artist",
    tab: "Artists",
    blurb: "Press shots, music videos and live visuals.",
    presets: [
      { id: "performance", label: "Performance Shot", Icon: Star,     prompt: "Ultra-realistic live performance shot, professional stage lighting, magazine quality", to: "/studio" },
      { id: "music-video", label: "Music Video",      Icon: Music,    prompt: "Cinematic music video still, dramatic lighting, music artist style",                to: "/studio" },
      { id: "colors",      label: "Colors Studio",    Icon: Droplets, prompt: "Single-color cyclorama studio background, clean professional backdrop",             to: "/colors" },
      { id: "cover",       label: "Cover Art",        Icon: Disc3,    prompt: "Album cover artwork, bold graphic composition, striking single subject",            to: "/studio" },
      { id: "editorial",   label: "Editorial",        Icon: Aperture, prompt: "High fashion editorial photograph, magazine style, artistic composition",           to: "/studio" },
      { id: "custom",      label: "Custom",           Icon: Pen,      prompt: "",                                                                                  to: "/studio" },
    ],
    tools: [
      { label: "Colors Studio",  to: "/colors",        Icon: Droplets },
      { label: "Image Studio",   to: "/studio",        Icon: Sparkles },
      { label: "Live Studios",   to: "/live-studio",   Icon: Mic2     },
      { label: "Directors ROOM", to: "/scene-builder", Icon: Film     },
      { label: "Scene Weaver",  to: "/scene-weaver",  Icon: Camera   },
      { label: "Lyric Video",    to: "/music-video",   Icon: Music    },
      { label: "Storyboard",     to: "/storyboard",    Icon: Layers   },
      { label: "Photo Editor",   to: "/photo-edit",    Icon: Palette  },
      { label: "Motion",         to: "/motion",        Icon: Wand2    },
    ],
    inspirations: [
      { id: "a1", label: "Performance Shot",  tag: "Stage",     gradient: "linear-gradient(135deg,#2a0d10,#7f1d1d)", Icon: Star,     presetId: "performance" },
      { id: "a2", label: "Music Video Still", tag: "Cinematic", gradient: "linear-gradient(135deg,#0d1117,#26141a)", Icon: Music,    presetId: "music-video" },
      { id: "a3", label: "Colors Studio",     tag: "Backdrop",  gradient: "linear-gradient(135deg,#111827,#374151)", Icon: Droplets, presetId: "colors"      },
      { id: "a4", label: "Cover Art",         tag: "Release",   gradient: "linear-gradient(135deg,#3f1418,#9a3412)", Icon: Disc3,    presetId: "cover"       },
      { id: "a5", label: "Editorial Look",    tag: "Fashion",   gradient: "linear-gradient(135deg,#1c1917,#57534e)", Icon: Aperture, presetId: "editorial"   },
      { id: "a6", label: "Custom Prompt",     tag: "Freestyle", gradient: "linear-gradient(135deg,#0f0f12,#2a0d10)", Icon: Pen,      presetId: "custom"      },
    ],
  },
  creator: {
    id: "creator",
    label: "Creator",
    tab: "Creators",
    blurb: "UGC ads, short-form hooks and talking avatars.",
    presets: [
      { id: "ugc",     label: "UGC Ad",         Icon: Video,       prompt: "Authentic UGC-style content creator advertisement, natural lighting, handheld feel", to: "/ugc"    },
      { id: "avatar",  label: "Talking Avatar", Icon: ScanFace,    prompt: "Talking head presenter, clean background, direct to camera",                         to: "/avatar" },
      { id: "hook",    label: "TikTok Hook",    Icon: Clapperboard, prompt: "Scroll-stopping vertical short-form opening frame, high contrast, bold subject",     to: "/spin"   },
      { id: "grwm",    label: "GRWM",           Icon: Shirt,       prompt: "Get ready with me style selfie video, mirror lighting, outfit focus",                 to: "/studio" },
      { id: "product", label: "Product Demo",   Icon: Camera,      prompt: "Product held to camera, bright clean lighting, lifestyle context",                    to: "/ugc"    },
      { id: "custom",  label: "Custom",         Icon: Pen,         prompt: "",                                                                                    to: "/studio" },
    ],
    tools: [
      { label: "UGC Ads",         to: "/ugc",       Icon: Video       },
      { label: "Content Line",    to: "/ugc-line",  Icon: Layers      },
      { label: "Lip Sync",        to: "/lipsync",   Icon: Mic2        },
      { label: "TikTok30",        to: "/spin",      Icon: Clapperboard },
      { label: "Talking Avatars", to: "/avatar",    Icon: ScanFace    },
      { label: "Image Studio",    to: "/studio",    Icon: Sparkles    },
      { label: "Photo Editor",    to: "/photo-edit", Icon: Palette    },
    ],
    inspirations: [
      { id: "c1", label: "TikTok UGC Ad",   tag: "Viral",     gradient: "linear-gradient(135deg,#3f1418,#9a3412)", Icon: Video,       presetId: "ugc"     },
      { id: "c2", label: "Talking Avatar",  tag: "Presenter", gradient: "linear-gradient(135deg,#0d1117,#26141a)", Icon: ScanFace,    presetId: "avatar"  },
      { id: "c3", label: "Hook Frame",      tag: "Short-form", gradient: "linear-gradient(135deg,#2a0d10,#7f1d1d)", Icon: Clapperboard, presetId: "hook"  },
      { id: "c4", label: "Get Ready W/ Me", tag: "Outfit",    gradient: "linear-gradient(135deg,#111827,#374151)", Icon: Shirt,       presetId: "grwm"    },
      { id: "c5", label: "Product Demo",    tag: "Commerce",  gradient: "linear-gradient(135deg,#1c1917,#57534e)", Icon: Camera,      presetId: "product" },
      { id: "c6", label: "Custom Prompt",   tag: "Freestyle", gradient: "linear-gradient(135deg,#0f0f12,#2a0d10)", Icon: Pen,         presetId: "custom"  },
    ],
  },
};

const SIDE_ORDER: SideId[] = ["artist", "creator"];

// ── Staggered heights ─────────────────────────────────────────────────────────
const LEFT_H  = [200, 150, 210, 160, 190, 145, 220, 155];
const RIGHT_H = [155, 205, 145, 215, 150, 200, 160, 190];

// ── Sub-components ────────────────────────────────────────────────────────────
interface GenItem {
  id: string;
  kind?: string | null;
  prompt?: string | null;
  status?: string | null;
  result_image_url?: string | null;
  result_video_url?: string | null;
  created_at?: string | null;
}

function GalleryCard({ item, height, onTry }: { item: GenItem; height: number; onTry: (p: string) => void }) {
  const [hovered, setHovered] = useState(false);
  if (!item.result_image_url && !item.result_video_url) return null;
  return (
    <div
      style={{ height, borderRadius: 12, overflow: "hidden", position: "relative", background: "#141418", cursor: "pointer" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => item.prompt && onTry(item.prompt)}
    >
      {item.result_image_url && (
        <img src={item.result_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} loading="lazy" />
      )}
      {item.result_video_url && !item.result_image_url && (
        <video src={item.result_video_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} autoPlay muted loop playsInline />
      )}
      <div style={{
        position: "absolute", inset: 0,
        background: hovered ? "rgba(0,0,0,0.48)" : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.18s",
        borderRadius: 12,
      }}>
        {hovered && (
          <span style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "var(--primary)",
            padding: "6px 14px", borderRadius: 20,
            color: "#fff", fontSize: 13, fontWeight: 700,
          }}>
            <Sparkles size={11} /> Reuse prompt
          </span>
        )}
      </div>
    </div>
  );
}

function InspirationCard({ item, height, onTry }: { item: Inspiration; height: number; onTry: (presetId: string) => void }) {
  const [hovered, setHovered] = useState(false);
  // Alias to uppercase so the cartographer/JSX transform can resolve it as a component
  const ItemIcon = item.Icon;
  return (
    <div
      onClick={() => onTry(item.presetId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height, borderRadius: 12, overflow: "hidden", cursor: "pointer",
        background: item.gradient,
        padding: 12, display: "flex", flexDirection: "column",
        transform: hovered ? "scale(0.98)" : "scale(1)",
        transition: "transform 0.15s",
        boxShadow: hovered ? "0 8px 28px -8px rgba(0,0,0,0.5)" : "none",
      }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.13)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <ItemIcon size={17} color="rgba(255,255,255,0.9)" />
      </div>
      <div style={{ flex: 1 }} />
      <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, marginBottom: 3 }}>{item.tag}</p>
      <p style={{ margin: "0 0 7px", fontSize: 13, color: "#fff", fontWeight: 700, lineHeight: 1.3 }}>{item.label}</p>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.14)", padding: "4px 10px", borderRadius: 16, fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 600, alignSelf: "flex-start" }}>
        <Sparkles size={9} /> Try this
      </span>
    </div>
  );
}

/** Shown once to accounts that were created before the signup question existed
 *  (or signed up with GitHub/Apple, where there is no form to ask on). */
function PersonaAsk({ onPick, busy }: { onPick: (p: SideId) => void; busy: boolean }) {
  return (
    <div style={{
      borderRadius: 16, padding: 14, marginBottom: 14,
      border: "1px solid oklch(0.58 0.22 25 / 0.30)",
      background: "oklch(0.58 0.22 25 / 0.07)",
    }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "oklch(0.96 0.01 272)" }}>Quick one — which are you?</p>
      <p style={{ margin: "3px 0 10px", fontSize: 12, color: "oklch(0.62 0.01 272)" }}>
        Aurora will open on your side and put those tools first.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        {SIDE_ORDER.map((id) => {
          const SideIcon = id === "artist" ? Mic2 : Clapperboard;
          return (
            <button
              key={id}
              type="button"
              disabled={busy}
              onClick={() => onPick(id)}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "10px 12px", borderRadius: 12,
                border: "1px solid oklch(1 0 0 / 0.12)",
                background: "oklch(1 0 0 / 0.05)",
                color: "oklch(0.96 0.01 272)", fontSize: 13, fontWeight: 700,
                cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1,
              }}
            >
              <SideIcon size={15} />
              I'm {id === "artist" ? "an Artist" : "a Creator"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Suppress SSR/client hydration mismatch: the grid content depends on auth
  // state that is only available client-side (no session during SSR). Render a
  // neutral blank shell on the server; the real page mounts after first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const profileFn = useServerFn(getMyProfile);
  const listFn    = useServerFn(listGenerations);
  const personaFn = useServerFn(setMyPersona);

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

  const storedPersona: SideId | null =
    profile?.persona === "artist" || profile?.persona === "creator" ? profile.persona : null;

  // Which side is on screen. Defaults to the signup choice; flipping is a view
  // change only — it deliberately does NOT overwrite the stored persona, so an
  // artist browsing creator tools stays an artist.
  const [sideOverride, setSideOverride] = useState<SideId | null>(null);
  const activeSideId: SideId = sideOverride ?? storedPersona ?? "artist";
  const side = SIDES[activeSideId];

  const [personaBusy, setPersonaBusy] = useState(false);
  const handlePickPersona = useCallback(async (p: SideId) => {
    setPersonaBusy(true);
    setSideOverride(p);
    try {
      await personaFn({ data: { persona: p } });
      await queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    } finally {
      setPersonaBusy(false);
    }
  }, [personaFn, queryClient, user?.id]);

  const gallery: GenItem[] = useMemo(
    () => (hist?.items ?? []).filter(
      (i) => (i.status === "complete" || i.status === "succeeded") && (i.result_image_url || i.result_video_url)
    ),
    [hist]
  );

  const composerPlaceholder =
    useSiteCopyValue("home_composer_placeholder") ?? "Describe what you want to make…";

  const [presetId, setPresetId] = useState<string | null>(null);
  const [prompt, setPrompt]     = useState("");
  const [feed, setFeed]         = useState<"trends" | "mine">("trends");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const selectedPreset: Preset =
    side.presets.find((p) => p.id === presetId) ?? side.presets[0];

  // Presets and inspirations are per-side, so reset the selection on a flip.
  const flipTo = useCallback((id: SideId) => {
    setSideOverride(id);
    setPresetId(null);
    setFeed("trends");
  }, []);

  // Build combined grid
  const gridItems = useMemo(() => {
    type GridItem =
      | { type: "gallery";     data: GenItem;     id: string }
      | { type: "inspiration"; data: Inspiration; id: string };

    const galleryItems: GridItem[] = gallery.map((g) => ({ type: "gallery" as const, data: g, id: g.id }));
    if (feed === "mine") return galleryItems;

    const inspoItems: GridItem[] = side.inspirations.map((i) => ({ type: "inspiration" as const, data: i, id: i.id }));

    const combined: GridItem[] = [];
    let gi = 0, ii = 0;
    const total = galleryItems.length + inspoItems.length;
    for (let k = 0; k < total; k++) {
      if (gi < galleryItems.length && (ii >= inspoItems.length || k % 3 !== 2)) {
        combined.push(galleryItems[gi++]);
      } else if (ii < inspoItems.length) {
        combined.push(inspoItems[ii++]);
      }
    }
    return combined;
  }, [gallery, side, feed]);

  const [leftCol, rightCol] = useMemo(() => {
    const L: typeof gridItems = [], R: typeof gridItems = [];
    gridItems.forEach((item, i) => (i % 2 === 0 ? L : R).push(item));
    return [L, R];
  }, [gridItems]);

  const handleTryGallery = useCallback((p: string) => {
    setPrompt(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const handleTryInspiration = useCallback((id: string) => {
    setPresetId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => inputRef.current?.focus(), 200);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPrompt = selectedPreset.prompt
      ? `${selectedPreset.prompt}${prompt ? `. ${prompt}` : ""}`
      : prompt || "Professional portrait, high quality";
    void navigate({ to: selectedPreset.to as "/studio", search: { q: finalPrompt } });
  };

  // During SSR (or before first client paint) show a neutral shell so that
  // server HTML matches client HTML — avoids a hydration mismatch cascade.
  if (!mounted) {
    return (
      <div className="aurora-page-shell min-h-screen" style={{ overflow: "hidden" }}>
        <span aria-hidden className="aurora-ambient" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="aurora-page-shell min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const TOP_H = 56;  // HomeTopBar height
  const NAV_H = 64;  // MobileNav tab bar (4rem)

  return (
    <div className="aurora-page-shell aurora-content-shell relative min-h-screen text-foreground">
      <span aria-hidden className="aurora-ambient" />

      <style>{`
        @keyframes side-flip-in {
          from { opacity: 0; transform: perspective(1200px) rotateY(-14deg) translateX(10px); }
          to   { opacity: 1; transform: perspective(1200px) rotateY(0deg) translateX(0); }
        }
        .side-flip { animation: side-flip-in 0.32s cubic-bezier(0.22,0.8,0.3,1) both; transform-origin: left center; }
      `}</style>

      <HomeTopBar credits={credits} avatarInitial={avatarInitial} />

      <div style={{
        paddingTop: TOP_H + 14,
        paddingBottom: NAV_H + 24,
         paddingLeft: 12, paddingRight: 12,
        position: "relative", zIndex: 10,
      }}>
        <div style={{ width: "100%", maxWidth: 1040, margin: "0 auto" }}>
        {/* ── FOR ARTISTS / FOR CREATORS — page-level toggle ── */}
        <div
          role="tablist"
          aria-label="Studio mode"
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}
        >
          {SIDE_ORDER.map((id) => {
            const active = id === activeSideId;
            const TabIcon = id === "artist" ? Mic2 : Clapperboard;
            const sub = id === "artist"
              ? "Press shots · Music videos · Live visuals"
              : "UGC ads · Short-form · Avatars";
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => flipTo(id)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5,
                  padding: "14px 14px 13px", borderRadius: 18, border: "none", textAlign: "left",
                  cursor: "pointer",
                  background: active
                    ? "linear-gradient(135deg, oklch(0.58 0.22 25 / 0.22), oklch(0.62 0.18 30 / 0.12))"
                    : "oklch(1 0 0 / 0.04)",
                  boxShadow: active
                    ? "inset 0 0 0 1.5px oklch(0.58 0.22 25 / 0.55), 0 4px 20px -6px oklch(0.58 0.22 25 / 0.25)"
                    : "inset 0 0 0 1px oklch(1 0 0 / 0.09)",
                  transition: "all 0.22s cubic-bezier(0.22, 0.8, 0.3, 1)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 9, flexShrink: 0,
                    background: active ? "oklch(0.58 0.22 25 / 0.25)" : "oklch(1 0 0 / 0.07)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.2s",
                  }}>
                    <TabIcon size={14} color={active ? "oklch(0.88 0.16 28)" : "oklch(0.55 0.01 272)"} />
                  </span>
                  <span style={{
                    fontSize: 14.5, fontWeight: 800, letterSpacing: "-0.01em",
                    color: active ? "oklch(0.90 0.14 28)" : "oklch(0.68 0.01 272)",
                    transition: "color 0.2s",
                  }}>
                    For {SIDES[id].tab}
                  </span>
                  {storedPersona === id && (
                    <span style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: "0.08em",
                      background: "oklch(0.58 0.22 25 / 0.22)", color: "oklch(0.82 0.14 28)",
                      padding: "2px 6px", borderRadius: 6,
                    }}>YOU</span>
                  )}
                </span>
                <span style={{
                  fontSize: 10.5, fontWeight: 500, lineHeight: 1.4, paddingLeft: 35,
                  color: active ? "oklch(0.68 0.08 28)" : "oklch(0.44 0.01 272)",
                  transition: "color 0.2s",
                }}>
                  <EditableCopy
                    copyKey={id === "artist" ? "home_artist_tab_sub" : "home_creator_tab_sub"}
                    fallback={sub}
                  />
                </span>
              </button>
            );
          })}
        </div>

        {/* ── One-time persona question for accounts that never got asked ── */}
        {!storedPersona && <PersonaAsk onPick={handlePickPersona} busy={personaBusy} />}

        {/* ── Heading ── */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "oklch(0.58 0.01 272)" }}>
            Create
          </p>
          <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", color: "oklch(0.97 0.01 272)" }}>
          <EditableCopy
            copyKey={activeSideId === "artist" ? "home_artist_heading" : "home_creator_heading"}
            fallback="Start creating"
          />
          </h1>
          <p style={{ margin: "5px 0 0", fontSize: 12, color: "oklch(0.52 0.01 272)" }}>
            Describe the image, video, or social post you want to make.
          </p>
        </div>

        {/* ── Composer ── */}
        <form
          onSubmit={handleSubmit}
          style={{
            borderRadius: 18, padding: 12, marginBottom: 16,
            border: "1px solid oklch(1 0 0 / 0.09)",
            background: "oklch(1 0 0 / 0.045)",
            backdropFilter: "blur(18px) saturate(1.4)",
            WebkitBackdropFilter: "blur(18px) saturate(1.4)",
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {/* Reference photo → opens the studio, where uploads live */}
            <button
              type="button"
              onClick={() => void navigate({ to: "/studio" })}
              title="Add a reference photo in the studio"
              aria-label="Add a reference photo in the studio"
              style={{
                width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                border: "1px dashed oklch(1 0 0 / 0.18)",
                background: "oklch(1 0 0 / 0.04)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Camera size={19} color="oklch(0.60 0.01 272)" />
            </button>

            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder={
                selectedPreset.prompt
                  ? `Add your details for ${selectedPreset.label}…`
                  : composerPlaceholder
              }
              style={{
                flex: 1, minHeight: 52, resize: "none",
                background: "transparent", border: "none", outline: "none",
                color: "oklch(0.96 0.01 272)", fontSize: 15, lineHeight: 1.45,
                fontFamily: "inherit", paddingTop: 4,
              }}
            />

            {prompt && (
              <button
                type="button"
                onClick={() => setPrompt("")}
                aria-label="Clear prompt"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
              >
                <X size={15} color="oklch(0.55 0.01 272)" />
              </button>
            )}
          </div>

          {/* Style chips + send */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <div
              className="flex gap-1.5 overflow-x-auto"
              style={{ flex: 1, scrollbarWidth: "none" } as React.CSSProperties}
            >
              {side.presets.map((p) => {
                const active = p.id === selectedPreset.id;
                // Alias to uppercase so the cartographer/JSX transform resolves it as a component
                const PresetIcon = p.Icon;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPresetId(p.id)}
                    style={{
                      flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                      padding: "6px 11px", borderRadius: 16,
                      border: `1px solid ${active ? "var(--primary)" : "oklch(1 0 0 / 0.08)"}`,
                      background: active ? "oklch(0.60 0.24 28 / 0.18)" : "oklch(1 0 0 / 0.04)",
                      color: active ? "oklch(0.82 0.16 28)" : "oklch(0.58 0.01 272)",
                      fontSize: 11.5, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <PresetIcon size={11} />
                    {p.label}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              aria-label="Start generating"
              style={{
                width: 40, height: 40, borderRadius: 20, flexShrink: 0,
                background: "var(--gradient-hero)",
                border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
                boxShadow: "var(--shadow-glow-soft)",
              }}
            >
              <ArrowUp size={19} color="#fff" />
            </button>
          </div>
        </form>

        {/* Everything below flips as one page when the side changes */}
        <div key={activeSideId} className="side-flip">

          <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Need a focused workflow?</span>
            <Link to="/studio" className="font-semibold text-primary no-underline hover:underline">Open Studio</Link>
            <span className="text-border">·</span>
            <Link to="/content" className="font-semibold text-primary no-underline hover:underline">Open Content</Link>
          </div>

          {/* ── Feed tabs ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            {([["trends", "Trends"], ["mine", "Your work"]] as const).map(([id, label]) => {
              const active = feed === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFeed(id)}
                  style={{
                    background: "none", border: "none", padding: "2px 0", cursor: "pointer",
                    fontSize: 14.5, fontWeight: 700,
                    color: active ? "oklch(0.96 0.01 272)" : "oklch(0.50 0.01 272)",
                    borderBottom: `2px solid ${active ? "var(--primary)" : "transparent"}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
            <Link
              to="/gallery"
              style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 12, fontWeight: 600, color: "oklch(0.58 0.01 272)", textDecoration: "none" }}
            >
              Gallery <ChevronRight size={13} />
            </Link>
          </div>

          {/* ── Staggered grid ── */}
          {gridItems.length === 0 ? (
            <div style={{
              borderRadius: 14, padding: "28px 18px", textAlign: "center",
              border: "1px dashed oklch(1 0 0 / 0.10)",
              background: "oklch(1 0 0 / 0.025)",
            }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "oklch(0.80 0.01 272)" }}>
                Nothing here yet
              </p>
              <p style={{ margin: "5px 0 0", fontSize: 12, color: "oklch(0.55 0.01 272)" }}>
                Your finished work will show up here once you make something.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                {leftCol.map((item, i) =>
                  item.type === "gallery" ? (
                    <GalleryCard key={item.id} item={item.data} height={LEFT_H[i % LEFT_H.length]} onTry={handleTryGallery} />
                  ) : (
                    <InspirationCard key={item.id} item={item.data} height={LEFT_H[i % LEFT_H.length]} onTry={handleTryInspiration} />
                  )
                )}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, marginTop: 28 }}>
                {rightCol.map((item, i) =>
                  item.type === "gallery" ? (
                    <GalleryCard key={item.id} item={item.data} height={RIGHT_H[i % RIGHT_H.length]} onTry={handleTryGallery} />
                  ) : (
                    <InspirationCard key={item.id} item={item.data} height={RIGHT_H[i % RIGHT_H.length]} onTry={handleTryInspiration} />
                  )
                )}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
