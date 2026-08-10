import { createLazyFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  ChevronRight,
  History,
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  Sparkles,
  Star,
  Video,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { listGenerations } from "@/lib/studio.functions";
import { getMyProfile } from "@/lib/billing.functions";
import { AuroraToolsSheet } from "@/components/AuroraToolsSheet";
import { EditableCopy } from "@/components/EditableCopy";
import { useSiteCopyValue } from "@/components/landing/SiteCopyProvider";
import { INSPIRATION_IMAGES } from "@/lib/mediaAssets";

export const Route = createLazyFileRoute("/home")({ component: HomePage });

// Shown while the user has no finished generations yet.
const FALLBACK_REELS: { src: string; label: string }[] = [
  { src: INSPIRATION_IMAGES.a1, label: "Performance shot" },
  { src: INSPIRATION_IMAGES.a2, label: "Music video still" },
  { src: INSPIRATION_IMAGES.a4, label: "Cover art" },
  { src: INSPIRATION_IMAGES.a5, label: "Editorial look" },
];

// Idea starters
const IDEA_CHIPS = [
  { id: "performance", label: "Performance shot", prompt: "Ultra-realistic live performance shot, professional stage lighting, magazine quality" },
  { id: "music-video", label: "Music video still", prompt: "Cinematic music video still, dramatic lighting, music artist style" },
  { id: "cover", label: "Album cover", prompt: "Album cover artwork, bold graphic composition, striking single subject" },
  { id: "editorial", label: "Editorial look", prompt: "High fashion editorial photograph, magazine style, artistic composition" },
] as const;

// Numbered tool list — the premium feature index shown on home.
type ToolRow = {
  idx: string;
  name: string;
  badge?: string;
  description: string;
  price: string;
  to: string;
  previewImg?: string;
  starred?: boolean;
};

const TOOL_ROWS: ToolRow[] = [
  { idx: "00", name: "AURORA STUDIO", badge: "FLAGSHIP", description: "Image & video generation", price: "FREE", to: "/studio", previewImg: "/nav-previews/studio.jpg", starred: true },
  { idx: "01", name: "COLORS", description: "Performance photo shoot", price: "2 CR", to: "/colors", previewImg: "/nav-previews/colors.jpg", starred: true },
  { idx: "02", name: "TIKTOK30", description: "UGC campaign engine", price: "6 CR", to: "/spin", previewImg: "/nav-previews/spin.jpg", starred: true },
  { idx: "03", name: "VIDEO AGENT", description: "AI video production assistant", price: "10 CR", to: "/video-agent", previewImg: "/nav-previews/video-agent.jpg" },
  { idx: "04", name: "DIRECTOR'S ROOM", badge: "SUITE", description: "Cinematic visual studio", price: "12 CR", to: "/scene-builder", previewImg: "/nav-previews/scene-builder.jpg" },
  { idx: "05", name: "LIP SYNC", description: "Audio-synced video", price: "8 CR", to: "/lipsync", previewImg: "/nav-previews/lipsync.jpg" },
  { idx: "06", name: "MOTION CONTROL", badge: "FLAGSHIP", description: "Kinetic visual generation", price: "10 CR", to: "/motion", previewImg: "/nav-previews/motion.jpg" },
];

function ToolRowItem({ row }: { row: ToolRow }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      to={row.to}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-center gap-3 border-b border-white/8 px-1 py-4 no-underline transition-colors duration-150 active:bg-white/5"
      style={hovered ? { background: "oklch(0.60 0.27 295 / 0.07)" } : undefined}
    >
      {/* Background preview image that fades in on hover */}
      {row.previewImg && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
          style={{ opacity: hovered ? 0.18 : 0, transition: "opacity 0.25s ease" }}
        >
          <img
            src={row.previewImg}
            alt=""
            className="h-full w-full object-cover object-top"
          />
          <span className="absolute inset-0" style={{ background: "linear-gradient(90deg, oklch(0.09 0.022 272 / 0.7) 0%, transparent 60%)" }} />
        </span>
      )}

      {/* Index number */}
      <span className="relative shrink-0 w-6 text-[11px] font-bold tabular-nums text-muted-foreground/50 leading-none pt-0.5">
        {row.idx}
      </span>

      {/* Name + badge */}
      <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-extrabold uppercase tracking-tight text-foreground leading-none">
            {row.name}
          </span>
          {row.badge && (
            <span
              className="rounded-[4px] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{ background: "oklch(0.60 0.27 295 / 0.18)", color: "oklch(0.80 0.16 305)", border: "1px solid oklch(0.60 0.27 295 / 0.30)" }}
            >
              {row.badge}
            </span>
          )}
          {row.starred && (
            <Star className="size-3 shrink-0 fill-[oklch(0.82_0.18_85)] text-[oklch(0.82_0.18_85)]" aria-label="Featured" />
          )}
        </span>
        <span className="text-[12px] text-muted-foreground leading-snug mt-0.5">{row.description}</span>
      </div>

      {/* Price + open */}
      <div className="relative flex shrink-0 items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
          style={
            row.price === "FREE"
              ? { background: "oklch(0.60 0.27 295 / 0.12)", color: "oklch(0.80 0.18 305)" }
              : { background: "oklch(1 0 0 / 0.06)", color: "oklch(0.70 0 0)" }
          }
        >
          {row.price}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
          OPEN →
        </span>
      </div>
    </Link>
  );
}

/** Two-card "Ads" section — Meta + TikTok, AdSkull-style with Aurora violet. */
function AdsSection() {
  return (
    <section className="mt-8">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
        Ad Creative Studio
      </p>
      <div className="grid grid-cols-2 gap-3">
        {/* Meta Ads */}
        <Link
          to="/ugc"
          className="group flex flex-col gap-3 rounded-2xl border p-4 no-underline transition"
          style={{ background: "oklch(0.12 0.035 295 / 0.8)", borderColor: "oklch(0.60 0.27 295 / 0.20)" }}
        >
          <span
            className="flex size-9 items-center justify-center rounded-xl text-sm font-black"
            style={{ background: "oklch(0.60 0.27 295 / 0.15)", color: "oklch(0.80 0.16 305)" }}
          >
            f
          </span>
          <div>
            <p className="text-[13px] font-bold text-foreground">Meta Ads</p>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">UGC-style ads for Instagram & Facebook in 60 s.</p>
          </div>
          <span
            className="mt-auto inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-semibold no-underline transition group-hover:brightness-110"
            style={{ background: "oklch(0.60 0.27 295 / 0.15)", color: "oklch(0.82 0.15 310)" }}
          >
            Start creating <ArrowRight className="size-3.5" />
          </span>
        </Link>

        {/* TikTok Ads */}
        <Link
          to="/spin"
          className="group flex flex-col gap-3 rounded-2xl border p-4 no-underline transition"
          style={{ background: "oklch(0.12 0.025 285 / 0.8)", borderColor: "oklch(0.60 0.27 295 / 0.15)" }}
        >
          <span
            className="flex size-9 items-center justify-center rounded-xl text-sm font-black"
            style={{ background: "oklch(0.55 0.27 295 / 0.18)", color: "oklch(0.80 0.16 305)" }}
          >
            TT
          </span>
          <div>
            <p className="text-[13px] font-bold text-foreground">TikTok Ads</p>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Hook-first short-form campaign packs. Bulk-ready.</p>
          </div>
          <span
            className="mt-auto inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-semibold no-underline transition group-hover:brightness-110"
            style={{ background: "oklch(0.55 0.27 295 / 0.15)", color: "oklch(0.82 0.15 310)" }}
          >
            Start creating <ArrowRight className="size-3.5" />
          </span>
        </Link>
      </div>
    </section>
  );
}

function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [mounted, setMounted] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mode, setMode] = useState<"image" | "video">("image");
  const [idea, setIdea] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const profileFn = useServerFn(getMyProfile);
  const listFn = useServerFn(listGenerations);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => profileFn(),
    enabled: !!user,
  });
  const { data: hist } = useQuery({
    queryKey: ["gens", user?.id],
    queryFn: () => listFn(),
    enabled: !!user,
  });

  const credits = profile?.credits ?? null;

  const reels = useMemo(
    () =>
      (hist?.items ?? [])
        .filter(
          (i) =>
            (i.status === "complete" || i.status === "succeeded") &&
            (i.result_image_url || i.result_video_url),
        )
        .slice(0, 4),
    [hist],
  );

  const composerPlaceholder =
    useSiteCopyValue("home_composer_placeholder") ?? "Enter your ideas";

  const submitIdea = () => {
    const text = idea.trim();
    if (mode === "video") {
      void navigate({ to: "/motion", search: text ? { prompt: text } : {} });
    } else {
      void navigate({ to: "/studio", search: text ? { q: text } : {} });
    }
  };

  if (!mounted || loading || !user) {
    return (
      <div className="min-h-dvh w-full" style={{ background: "var(--gradient-page)" }} />
    );
  }

  return (
    <div className="min-h-dvh w-full" style={{ background: "var(--gradient-page)" }}>
      <main className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col px-5 pb-64">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between pt-5">
          <button
            type="button"
            aria-label="All tools"
            onClick={() => setToolsOpen(true)}
            className="rounded-xl p-1.5 text-foreground"
          >
            <LayoutGrid className="size-6" strokeWidth={1.8} />
          </button>
          <div className="flex items-center gap-1">
            <Link
              to="/gallery"
              aria-label="Your gallery"
              className="relative rounded-xl p-1.5 text-foreground"
            >
              <History className="size-6" strokeWidth={1.8} />
              {reels.length > 0 ? (
                <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-dot" />
              ) : null}
            </Link>
          </div>
        </header>

        {/* ── Hero — "CREATE SOMETHING NEW." ─────────────────────────────── */}
        <div className="mt-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">
            Every tool
          </p>
          <h1
            className="mt-1 text-[42px] font-black leading-[0.92] tracking-tighter"
            style={{
              background: "var(--gradient-text)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            <EditableCopy copyKey="home_headline_l1" fallback="CREATE" />
            <br />
            <EditableCopy copyKey="home_headline_l2" fallback="SOMETHING" />
            <br />
            <EditableCopy copyKey="home_headline_l3" fallback="NEW." />
          </h1>
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/50">
            {TOOL_ROWS.length} tools · Built for artists
          </p>
        </div>

        {/* ── Numbered tool list ──────────────────────────────────────────── */}
        <section className="mt-6" aria-label="Available tools">
          {TOOL_ROWS.map((row) => (
            <ToolRowItem key={row.to} row={row} />
          ))}
        </section>

        {/* ── Idea chips ─────────────────────────────────────────────────── */}
        <div className="mt-6 flex flex-wrap gap-2">
          {IDEA_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setIdea(chip.prompt);
                inputRef.current?.focus();
              }}
              className="rounded-full border border-border bg-card/60 px-4 py-2 text-[13.5px] font-medium text-foreground"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* ── Ads section (Meta + TikTok) ─────────────────────────────────── */}
        <AdsSection />

        {/* ── Latest renders strip ────────────────────────────────────────── */}
        <section className="mt-8 rounded-3xl bg-card p-2.5 shadow-[var(--shadow-card)]">
          <div className="grid grid-cols-4 gap-2">
            {reels.length > 0
              ? reels.map((g) => (
                  <Link
                    key={g.id}
                    to="/gallery"
                    className="relative block aspect-[9/16] overflow-hidden rounded-xl bg-secondary"
                  >
                    {g.result_video_url ? (
                      <video
                        src={g.result_video_url}
                        muted
                        playsInline
                        preload="metadata"
                        className="size-full object-cover"
                      />
                    ) : (
                      <img
                        src={g.result_image_url ?? ""}
                        alt="One of your recent Aurora renders"
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    )}
                  </Link>
                ))
              : FALLBACK_REELS.map((r) => (
                  <Link
                    key={r.src + r.label}
                    to="/studio"
                    className="relative block aspect-[9/16] overflow-hidden rounded-xl bg-secondary"
                  >
                    <img src={r.src} alt={r.label} loading="lazy" className="size-full object-cover" />
                  </Link>
                ))}
          </div>
          <Link
            to="/tutorial"
            className="mt-2.5 flex items-center justify-between rounded-2xl px-3 py-2.5 text-[15px] font-semibold text-foreground"
          >
            <span>
              {reels.length > 0 ? "Your latest renders — keep going" : "See the recipe → see the result"}
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </Link>
        </section>
      </main>

      {/* ── Sticky composer (sits above the bottom nav) ──────────────────── */}
      <div
        className="fixed inset-x-0 z-40"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        <div
          className="mx-auto w-full max-w-[520px] rounded-t-3xl px-4 pb-3 pt-3 backdrop-blur-xl"
          style={{ background: "color-mix(in oklch, var(--background) 82%, transparent)", boxShadow: "var(--shadow-float)" }}
        >
          <div className="flex items-center gap-2">
            <Link
              to="/billing"
              className="flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-[13px] font-bold text-foreground shadow-[var(--shadow-card)]"
            >
              <Sparkles className="size-4 text-brand-ink" />
              {credits !== null ? `${credits} Aura` : "Aura"}
            </Link>
            <div className="flex items-center gap-1 rounded-full bg-card p-1 shadow-[var(--shadow-card)]">
              <button
                type="button"
                onClick={() => setMode("image")}
                aria-pressed={mode === "image"}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  mode === "image" ? "bg-brand text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <ImageIcon className="size-4" />
                Image
              </button>
              <button
                type="button"
                onClick={() => setMode("video")}
                aria-pressed={mode === "video"}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                  mode === "video" ? "bg-brand text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                <Video className="size-4" />
                Video
              </button>
            </div>
          </div>

          <form
            className="mt-2.5 flex items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-[var(--shadow-card)]"
            onSubmit={(e) => {
              e.preventDefault();
              submitIdea();
            }}
          >
            <button
              type="button"
              aria-label="Open the studio to add reference photos"
              onClick={() => void navigate({ to: "/studio" })}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground"
            >
              <Plus className="size-5" />
            </button>
            <input
              ref={inputRef}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder={composerPlaceholder}
              aria-label="Describe your idea"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label={mode === "video" ? "Create video" : "Create image"}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-primary-foreground"
              style={{ background: "var(--gradient-cta)" }}
            >
              <ArrowUp className="size-5" strokeWidth={2.4} />
            </button>
          </form>
        </div>
      </div>

      <AuroraToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </div>
  );
}
