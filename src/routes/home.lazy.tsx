import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Zap,
  X,
  Camera,
  Star,
  Music,
  Droplets,
  Video,
  Aperture,
  Pen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { listGenerations } from "@/lib/studio.functions";
import { getMyProfile } from "@/lib/billing.functions";
import { HomeTopBar } from "@/components/home/HomeTopBar";

export const Route = createLazyFileRoute("/home")({ component: HomePage });

// ── Presets ───────────────────────────────────────────────────────────────────
interface Preset {
  id: string;
  label: string;
  Icon: LucideIcon;
  prompt: string;
  to: string;
}
const PRESETS: Preset[] = [
  { id: "performance", label: "Performance Shot", Icon: Star,     prompt: "Ultra-realistic performance shot, professional studio lighting, magazine quality", to: "/agent" },
  { id: "music-video", label: "Music Video",       Icon: Music,    prompt: "Cinematic music video still, dramatic lighting, music artist style",                to: "/agent" },
  { id: "colors",      label: "Colors Studio",     Icon: Droplets, prompt: "Single-color cyclorama studio background, clean professional backdrop",             to: "/colors" },
  { id: "ugc",         label: "UGC Ad",             Icon: Video,    prompt: "Authentic UGC-style content creator advertisement, natural lighting",               to: "/ugc" },
  { id: "editorial",   label: "Editorial",          Icon: Aperture, prompt: "High fashion editorial photograph, Vogue magazine style, artistic composition",     to: "/agent" },
  { id: "custom",      label: "Custom",             Icon: Pen,      prompt: "",                                                                                  to: "/agent" },
];

// ── Inspiration cards ─────────────────────────────────────────────────────────
const INSPIRATIONS = [
  { id: "i1", label: "Performance Shot",  tag: "Studio",    gradient: "linear-gradient(135deg,#2d1b69,#5b21b6)", Icon: Star,     presetId: "performance" },
  { id: "i2", label: "Music Video Still", tag: "Cinematic", gradient: "linear-gradient(135deg,#0f172a,#1e1b4b)", Icon: Music,    presetId: "music-video" },
  { id: "i3", label: "Colors Studio",     tag: "Backdrop",  gradient: "linear-gradient(135deg,#0c4a6e,#0e7490)", Icon: Droplets, presetId: "colors"      },
  { id: "i4", label: "TikTok UGC Ad",     tag: "Viral",     gradient: "linear-gradient(135deg,#431407,#9a3412)", Icon: Video,    presetId: "ugc"         },
  { id: "i5", label: "Editorial Look",    tag: "Fashion",   gradient: "linear-gradient(135deg,#14532d,#166534)", Icon: Aperture, presetId: "editorial"   },
  { id: "i6", label: "Custom Prompt",     tag: "Freestyle", gradient: "linear-gradient(135deg,#1a1a2e,#16213e)", Icon: Pen,      presetId: "custom"      },
];

// ── Category chips ────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "all",          label: "All"         },
  { id: "performance",  label: "Performance" },
  { id: "music-video",  label: "Music Video" },
  { id: "colors",       label: "Colors"      },
  { id: "ugc",          label: "UGC"         },
  { id: "editorial",    label: "Editorial"   },
];

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
      style={{ height, borderRadius: 12, overflow: "hidden", position: "relative", background: "#1a1a2e", cursor: "pointer" }}
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
      {/* hover overlay */}
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
            <Zap size={11} /> Try
          </span>
        )}
      </div>
    </div>
  );
}

function InspirationCard({ item, height, onTry }: { item: typeof INSPIRATIONS[0]; height: number; onTry: (presetId: string) => void }) {
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
        <Zap size={9} /> Try this
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Suppress SSR/client hydration mismatch: the grid content depends on
  // auth state that is only available client-side (no session during SSR).
  // Render a neutral blank shell on the server; the real grid mounts after
  // the first client paint. This also prevents the cartographer plugin's
  // transform from running on dynamic JSX in an SSR context.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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

  const gallery: GenItem[] = useMemo(
    () => (hist?.items ?? []).filter(
      (i) => (i.status === "complete" || i.status === "succeeded") && (i.result_image_url || i.result_video_url)
    ),
    [hist]
  );

  const [selectedPreset, setSelectedPreset] = useState<Preset>(PRESETS[0]);
  const [prompt, setPrompt]                 = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const inputRef = useRef<HTMLInputElement>(null);

  // Build combined grid
  const gridItems = useMemo(() => {
    type GridItem =
      | { type: "gallery";     data: GenItem;                  id: string }
      | { type: "inspiration"; data: typeof INSPIRATIONS[0];  id: string };

    const galleryItems: GridItem[] = gallery
      .filter((g) => {
        if (activeCategory === "all") return true;
        if (activeCategory === "ugc") return g.kind === "ugc";
        if (activeCategory === "music-video") return g.kind === "video" || g.kind === "music_video";
        return true;
      })
      .map((g) => ({ type: "gallery" as const, data: g, id: g.id }));

    const inspoItems: GridItem[] = INSPIRATIONS
      .filter((i) => activeCategory === "all" || i.presetId === activeCategory)
      .map((i) => ({ type: "inspiration" as const, data: i, id: i.id }));

    const combined: GridItem[] = [];
    let gi = 0, ii = 0;
    const total = Math.max(galleryItems.length + inspoItems.length, 6);
    for (let k = 0; k < total; k++) {
      if (gi < galleryItems.length && (ii >= inspoItems.length || k % 3 !== 2)) {
        combined.push(galleryItems[gi++]);
      } else if (ii < inspoItems.length) {
        combined.push(inspoItems[ii++]);
      }
    }
    return combined;
  }, [gallery, activeCategory]);

  const [leftCol, rightCol] = useMemo(() => {
    const L: typeof gridItems = [], R: typeof gridItems = [];
    gridItems.forEach((item, i) => (i % 2 === 0 ? L : R).push(item));
    return [L, R];
  }, [gridItems]);

  const handleTryGallery = useCallback((p: string) => {
    setPrompt(p);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleTryInspiration = useCallback((presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset) setSelectedPreset(preset);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPrompt = selectedPreset.prompt
      ? `${selectedPreset.prompt}${prompt ? `. ${prompt}` : ""}`
      : prompt || "Professional portrait, high quality";
    void navigate({ to: selectedPreset.to as "/agent", search: { q: finalPrompt } });
  };

  // During SSR (or before first client paint) show a neutral shell so that
  // server HTML matches client HTML — avoids hydration mismatch cascade.
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

  const TOP_H    = 56;   // HomeTopBar height
  const CHIPS_H  = 44;   // category strip
  const NAV_H    = 64;   // MobileNav tab bar (4rem)
  const BOT_H    = 108;  // bottom composer

  return (
    <div className="aurora-page-shell relative min-h-screen text-foreground" style={{ overflow: "hidden" }}>
      <span aria-hidden className="aurora-ambient" />

      {/* ── Fixed header ── */}
      <HomeTopBar credits={credits} avatarInitial={avatarInitial} />

      {/* ── Sticky category chips ── */}
      <div style={{
        position: "fixed", top: TOP_H, left: 0, right: 0, zIndex: 40,
        height: CHIPS_H,
        background: "oklch(0.085 0.022 272 / 0.90)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        borderBottom: "1px solid oklch(1 0 0 / 0.055)",
        display: "flex", alignItems: "center",
      }}>
        <div className="flex gap-2 overflow-x-auto px-3 py-0" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
          {CATEGORIES.map((cat) => {
            const active = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  flexShrink: 0,
                  padding: "5px 13px", borderRadius: 20,
                  border: `1px solid ${active ? "var(--primary)" : "oklch(1 0 0 / 0.10)"}`,
                  background: active ? "oklch(0.60 0.24 293 / 0.18)" : "oklch(1 0 0 / 0.04)",
                  color: active ? "oklch(0.82 0.16 300)" : "oklch(0.55 0.01 272)",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable staggered grid ── */}
      <div style={{
        paddingTop: TOP_H + CHIPS_H + 10,
        paddingBottom: BOT_H + NAV_H + 16,
        paddingLeft: 10, paddingRight: 10,
        position: "relative", zIndex: 10,
      }}>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Left column */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {leftCol.map((item, i) =>
              item.type === "gallery" ? (
                <GalleryCard key={item.id} item={item.data} height={LEFT_H[i % LEFT_H.length]} onTry={handleTryGallery} />
              ) : (
                <InspirationCard key={item.id} item={item.data} height={LEFT_H[i % LEFT_H.length]} onTry={handleTryInspiration} />
              )
            )}
          </div>
          {/* Right column — offset down for stagger */}
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
      </div>

      {/* ── Fixed bottom composer — sits above the MobileNav tab bar ── */}
      <div style={{
        position: "fixed",
        bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))",
        left: 0, right: 0, zIndex: 45,
        background: "oklch(0.085 0.022 272 / 0.95)",
        backdropFilter: "blur(28px) saturate(1.6)",
        WebkitBackdropFilter: "blur(28px) saturate(1.6)",
        borderTop: "1px solid oklch(1 0 0 / 0.07)",
      }}>
        {/* Style chips */}
        <div
          className="flex gap-1.5 overflow-x-auto px-3 pt-2.5 pb-1.5"
          style={{ scrollbarWidth: "none" } as React.CSSProperties}
        >
          {PRESETS.map((p) => {
            const active = p.id === selectedPreset.id;
            // Alias to uppercase so the cartographer/JSX transform resolves it as a component
            const PresetIcon = p.Icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPreset(p)}
                style={{
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 16,
                  border: `1px solid ${active ? "var(--primary)" : "oklch(1 0 0 / 0.08)"}`,
                  background: active ? "oklch(0.60 0.24 293 / 0.18)" : "oklch(1 0 0 / 0.04)",
                  color: active ? "oklch(0.82 0.16 300)" : "oklch(0.55 0.01 272)",
                  fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                }}
              >
                <PresetIcon size={10} />
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Input row */}
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 12px 10px" }}
        >
          {/* Camera / reference */}
          <button
            type="button"
            onClick={() => void navigate({ to: "/studio" })}
            title="Open studio with reference photo"
            style={{
              width: 44, height: 44, borderRadius: 22, flexShrink: 0,
              border: "1px solid oklch(1 0 0 / 0.10)",
              background: "oklch(1 0 0 / 0.05)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Camera size={18} color="oklch(0.55 0.01 272)" />
          </button>

          {/* Prompt */}
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 6,
            background: "oklch(1 0 0 / 0.06)", border: "1px solid oklch(1 0 0 / 0.09)",
            borderRadius: 22, padding: "0 14px", height: 44,
          }}>
            <input
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                selectedPreset.id === "custom"
                  ? "Describe your vision…"
                  : `Add details for ${selectedPreset.label}…`
              }
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "oklch(0.96 0.01 272)", fontSize: 15,
              }}
            />
            {prompt && (
              <button type="button" onClick={() => setPrompt("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
                <X size={14} color="oklch(0.55 0.01 272)" />
              </button>
            )}
          </div>

          {/* Generate */}
          <button
            type="submit"
            style={{
              width: 44, height: 44, borderRadius: 22, flexShrink: 0,
              background: "var(--gradient-hero)",
              border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              boxShadow: "var(--shadow-glow-soft)",
            }}
          >
            <Zap size={20} color="#fff" />
          </button>
        </form>
      </div>
    </div>
  );
}
