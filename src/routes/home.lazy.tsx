import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listGenerations } from "@/lib/studio.functions";
import { getMyProfile } from "@/lib/billing.functions";
import { AutoplayVideo } from "@/components/ui/AutoplayVideo";
import {
  Sparkles,
  Mic,
  Clapperboard,
  Flame,
  Wand2,
  Film,
  Palette,
  Bot,
  UserCircle2,
  ArrowRight,
  Coins,
  Image as ImageIcon,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { useState, useRef, useEffect, type FormEvent } from "react";

export const Route = createLazyFileRoute("/home")({ component: HomePage });

// ── Featured tools ─────────────────────────────────────────────────────────

const FEATURED_TOOLS = [
  {
    label: "Motion Control",
    tagline: "30s clip → cinematic scene",
    to: "/motion",
    icon: Wand2,
    img: "/nav-previews/motion.jpg",
    price: "From 30 Aura",
  },
  {
    label: "Colors Studio",
    tagline: "Palette-matched performance sets",
    to: "/colors",
    icon: Palette,
    img: "/nav-previews/colors.jpg",
    price: "From 10 Aura",
  },
  {
    label: "Lip Sync",
    tagline: "Any video · any audio",
    to: "/lipsync",
    icon: Mic,
    img: "/nav-previews/lipsync.jpg",
    price: "From 20 Aura",
  },
  {
    label: "Video Agent",
    tagline: "AI creative director",
    to: "/agent",
    icon: Bot,
    img: "/nav-previews/video-agent.jpg",
    price: "From 8 Aura",
  },
  {
    label: "TikTok30",
    tagline: "30 campaign posts at once",
    to: "/spin",
    icon: Flame,
    img: "/nav-previews/spin.jpg",
    price: "85 Aura",
  },
  {
    label: "Music Video",
    tagline: "Lyric video from a still",
    to: "/music-video",
    icon: Clapperboard,
    img: "/nav-previews/music-video.jpg",
    price: "From 15 Aura",
  },
];

// ── Quick start ────────────────────────────────────────────────────────────

const QUICK_START = [
  { label: "New Image",  icon: Sparkles,    to: "/studio" },
  { label: "Lip Sync",   icon: Mic,         to: "/lipsync" },
  { label: "Music Video", icon: Clapperboard, to: "/music-video" },
  { label: "Spin Up",    icon: Flame,       to: "/spin" },
];

// ── Home page ──────────────────────────────────────────────────────────────

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

  const items     = hist?.items ?? [];
  const succeeded = items.filter((i) => (i.status === "complete" || i.status === "succeeded") && (i.result_image_url || i.result_video_url));
  const heroGen   = succeeded[0];
  const recent    = succeeded.slice(0, 6);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Creator";
  const aura        = profile?.credits ?? null;

  const [heroLoaded, setHeroLoaded] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center aurora-page-shell">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="aurora-page-shell text-foreground min-h-screen">
      <span aria-hidden className="aurora-ambient" />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-[52vw] max-h-[420px] overflow-hidden">
        {/* Background layer: last generation (or gradient fallback) */}
        <div className="absolute inset-0 z-0">
          {!heroGen && (
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(135deg, oklch(0.14 0.04 272) 0%, oklch(0.10 0.06 290) 60%, oklch(0.08 0.04 310) 100%)" }}
            />
          )}
          {heroGen?.result_image_url && (
            <img
              src={heroGen.result_image_url}
              alt=""
              aria-hidden
              onLoad={() => setHeroLoaded(true)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${heroLoaded ? "opacity-100" : "opacity-0"}`}
              style={{ filter: "blur(18px) saturate(0.9) brightness(0.45)", transform: "scale(1.08)" }}
            />
          )}
          {heroGen?.result_video_url && !heroGen.result_image_url && (
            <AutoplayVideo
              src={heroGen.result_video_url}
              className="absolute inset-0 h-full w-full object-cover opacity-40"
              style={{ filter: "blur(12px) brightness(0.45)", transform: "scale(1.08)" }}
              autoPlay
              playsInline
              loop
              muted
            />
          )}
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.085_0.022_272)] via-[oklch(0.085_0.022_272/0.55)] to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.085_0.022_272/0.7)] via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-8 pt-16">
          {/* Aura balance chip */}
          {aura !== null && (
            <div className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 backdrop-blur-sm">
              <Coins className="size-3 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-300">
                <span className="text-amber-400">{aura.toLocaleString()}</span> Aura
              </span>
            </div>
          )}

          <h1 className="text-[2.2rem] font-semibold leading-[1.05] tracking-tight text-white">
            Welcome back,{" "}
            <span className="font-serif italic text-primary">{displayName}.</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-[28ch]">
            {heroGen ? "Continue where you left off." : "Your creative studio — everything in one place."}
          </p>

          <div className="mt-5 flex items-center gap-3">
            <Link
              to="/studio"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary py-2.5 pl-4 pr-5 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_oklch(0.58_0.22_25/0.6)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              <Sparkles className="size-3.5" /> Create
            </Link>
            {recent.length > 0 && (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-zinc-300 backdrop-blur-sm transition-colors hover:bg-white/10"
              >
                Gallery
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Main content ────────────────────────────────────────────────── */}
      {/* Enough bottom padding to clear the fixed composer bar + mobile tab bar */}
      <div className="relative z-10 space-y-10 px-5 pt-8 pb-[calc(7rem+env(safe-area-inset-bottom))]">

        {/* ── Featured Tools ─────────────────────────────────────────── */}
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground/70">
              Featured Tools
            </h2>
            <Link
              to="/studio"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary/80 hover:text-primary transition-colors no-underline"
            >
              See all <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 snap-x snap-mandatory scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {FEATURED_TOOLS.map((tool) => (
              <Link
                key={tool.label}
                to={tool.to}
                className="group shrink-0 w-36 snap-start rounded-2xl overflow-hidden border border-white/[0.08] bg-zinc-900/60 backdrop-blur-sm no-underline transition-all hover:border-primary/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                {/* Cover image */}
                <div className="relative h-24 overflow-hidden bg-zinc-800/60">
                  <img
                    src={tool.img}
                    alt=""
                    aria-hidden
                    className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-2 left-2.5 flex size-6 items-center justify-center rounded-lg bg-black/40 backdrop-blur-sm ring-1 ring-white/10">
                    <tool.icon className="size-3 text-primary" />
                  </span>
                </div>
                {/* Label */}
                <div className="px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-zinc-100 leading-tight line-clamp-1">{tool.label}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-500 line-clamp-1">{tool.price}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Recent Work ────────────────────────────────────────────── */}
        {recent.length > 0 && (
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground/70">
                Recent Work
              </h2>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary/80 hover:text-primary transition-colors no-underline"
              >
                View all <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {recent.map((g) => (
                <article
                  key={g.id}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50"
                >
                  {g.result_image_url ? (
                    <img
                      src={g.result_image_url}
                      alt={g.prompt?.slice(0, 50) ?? ""}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : g.result_video_url ? (
                    <AutoplayVideo
                      src={g.result_video_url}
                      className="h-full w-full object-cover"
                      autoPlay={false}
                      playsInline
                      loop
                      onMouseEnter={(e) => e.currentTarget.play()}
                      onMouseLeave={(e) => e.currentTarget.pause()}
                    />
                  ) : null}
                  {/* Video badge */}
                  {g.result_video_url && (
                    <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                      <Film className="size-2.5" /> MP4
                    </span>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Empty state for new users */}
        {succeeded.length === 0 && (
          <section className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
            <ImageIcon className="size-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 mb-4">No generations yet — let's make your first one.</p>
            <Link
              to="/studio"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white"
            >
              <Sparkles className="size-3.5" /> Open Studio
            </Link>
          </section>
        )}

        {/* ── Quick Start ────────────────────────────────────────────── */}
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground/70">
            Quick Start
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {QUICK_START.map((qs) => (
              <Link
                key={qs.label}
                to={qs.to}
                className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-zinc-900/50 px-4 py-4 no-underline transition-all hover:border-primary/25 hover:bg-zinc-900/80 active:scale-[0.98]"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 transition-colors group-hover:bg-primary/15">
                  <qs.icon className="size-4 text-primary" />
                </span>
                <span className="text-sm font-medium text-zinc-200 leading-tight">{qs.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Explore ────────────────────────────────────────────────── */}
        <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
          <UserCircle2 className="size-5 text-primary mb-3" />
          <h2 className="text-base font-semibold text-zinc-100">Motion Control</h2>
          <p className="mt-1 text-sm text-zinc-400">Transfer your 30-second performance into any AI cinematic scene.</p>
          <Link
            to="/motion"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors no-underline"
          >
            Try it <ArrowRight className="size-3.5" />
          </Link>
        </section>
      </div>

      {/* ── Fixed bottom composer bar ────────────────────────────────── */}
      <BottomComposer />
    </main>
  );
}

// ── Bottom composer bar ─────────────────────────────────────────────────────

function BottomComposer() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q) {
      void navigate({ to: "/agent" });
      return;
    }
    void navigate({ to: "/agent", search: { q } });
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06]"
      style={{
        paddingBottom: "calc(4rem + env(safe-area-inset-bottom))",
        background: "oklch(0.085 0.022 272 / 0.94)",
        backdropFilter: "blur(24px) saturate(1.5)",
        WebkitBackdropFilter: "blur(24px) saturate(1.5)",
      }}
    >
      {/* Top accent line */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent 0%, oklch(0.58 0.22 25 / 0.4) 50%, transparent 100%)" }}
      />

      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 pt-3 pb-1">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5">
          <Sparkles className="size-3.5 shrink-0 text-primary/70" />
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe your idea…"
            className="flex-1 min-w-0 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary shadow-[0_4px_20px_-4px_oklch(0.58_0.22_25/0.5)] transition-all hover:scale-105 active:scale-95"
          aria-label="Open Video Agent"
        >
          <ArrowRight className="size-4 text-white" />
        </button>
      </form>
    </div>
  );
}
