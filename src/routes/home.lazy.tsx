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
  Film,
  Flame,
  Music2,
  Palette,
  ArrowRight,
  Coins,
  Image as ImageIcon,
  Loader2,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { useState, useRef, useEffect, type FormEvent } from "react";

export const Route = createLazyFileRoute("/home")({ component: HomePage });

// ── Tool categories ─────────────────────────────────────────────────────────

type Tool = {
  label: string;
  tagline: string;
  to: string;
  icon: LucideIcon;
  credits: number;
  creditDisplay?: string;
};

type Category = {
  id: string;
  label: string;
  tools: Tool[];
};

const TOOL_CATEGORIES: Category[] = [
  {
    id: "music-video",
    label: "Music Video Production",
    tools: [
      {
        label: "Music Video",
        tagline: "Full video production",
        to: "/music-video",
        icon: Music2,
        credits: 12,
      },
      {
        label: "Lip Sync",
        tagline: "Synced performance video",
        to: "/lipsync",
        icon: Mic,
        credits: 8,
      },
      {
        label: "Motion Control",
        tagline: "Cinematic video clips",
        to: "/motion",
        icon: Film,
        credits: 10,
      },
    ],
  },
  {
    id: "photo",
    label: "Photo & Visual",
    tools: [
      {
        label: "Colors Studio",
        tagline: "Performance photo sets",
        to: "/colors",
        icon: Palette,
        credits: 2,
      },
      {
        label: "Image Studio",
        tagline: "AI photo creation",
        to: "/studio",
        icon: Sparkles,
        credits: 2,
      },
    ],
  },
  {
    id: "social",
    label: "Social Content",
    tools: [
      {
        label: "TikTok30",
        tagline: "UGC campaign batch",
        to: "/spin",
        icon: Flame,
        credits: 6,
        creditDisplay: "85/batch",
      },
      {
        label: "Content Line",
        tagline: "Viral content series",
        to: "/ugc-line",
        icon: Layers,
        credits: 6,
      },
    ],
  },
];

// ── kind → badge label ───────────────────────────────────────────────────────

const KIND_BADGE: Record<string, string> = {
  image:       "COLORS",
  video:       "MOTION",
  lipsync:     "LIP SYNC",
  music_video: "MUSIC VIDEO",
  motion:      "MOTION",
  spin:        "TIKTOK UGC",
  ugc:         "UGC",
  lyric_video: "MUSIC VIDEO",
};

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
  const succeeded = items.filter(
    (i) =>
      (i.status === "complete" || i.status === "succeeded") &&
      (i.result_image_url || i.result_video_url),
  );
  const heroGen = succeeded[0];
  const recent  = succeeded.slice(0, 4);

  const displayName =
    profile?.display_name || user?.email?.split("@")[0] || "Creator";
  const aura = profile?.credits ?? null;

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
      <section className="relative min-h-[42vw] max-h-[300px] overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          {!heroGen && (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.14 0.04 272) 0%, oklch(0.10 0.06 290) 60%, oklch(0.08 0.04 310) 100%)",
              }}
            />
          )}
          {heroGen?.result_image_url && (
            <img
              src={heroGen.result_image_url}
              alt=""
              aria-hidden
              onLoad={() => setHeroLoaded(true)}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                heroLoaded ? "opacity-100" : "opacity-0"
              }`}
              style={{
                filter: "blur(20px) saturate(0.8) brightness(0.4)",
                transform: "scale(1.1)",
              }}
            />
          )}
          {heroGen?.result_video_url && !heroGen.result_image_url && (
            <AutoplayVideo
              src={heroGen.result_video_url}
              className="absolute inset-0 h-full w-full object-cover opacity-35"
              style={{ filter: "blur(14px) brightness(0.4)", transform: "scale(1.1)" }}
              autoPlay
              playsInline
              loop
              muted
            />
          )}
          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.085_0.022_272)] via-[oklch(0.085_0.022_272/0.6)] to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.085_0.022_272/0.7)] via-transparent to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-end px-5 pb-7 pt-14">
          {aura !== null && (
            <div className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1 backdrop-blur-sm">
              <Coins className="size-3 text-amber-400" />
              <span className="text-xs font-semibold text-zinc-300">
                <span className="text-amber-400">{aura.toLocaleString()}</span>{" "}
                Aura available
              </span>
            </div>
          )}

          <h1 className="text-[1.85rem] font-semibold leading-[1.1] tracking-tight text-white">
            What are we creating,{" "}
            <span className="font-serif italic text-primary">{displayName}?</span>
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Select a format to begin.
          </p>
        </div>
      </section>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div
        className="relative z-10 px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))]"
        style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
      >

        {/* ── Tool categories ───────────────────────────────────────────── */}
        {TOOL_CATEGORIES.map((cat) => (
          <section key={cat.id}>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
              {cat.label}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {cat.tools.map((tool) => (
                <ToolCard key={tool.label} tool={tool} />
              ))}
            </div>
          </section>
        ))}

        {/* ── Recent Projects ───────────────────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
              Recent Projects
            </p>
            <Link
              to="/dashboard"
              className="text-[11px] text-zinc-500 no-underline hover:text-zinc-300 transition-colors"
            >
              View all →
            </Link>
          </div>

          {recent.length > 0 ? (
            <div className="grid grid-cols-2 gap-2.5">
              {recent.map((g) => (
                <RecentCard key={g.id} g={g} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
              <ImageIcon className="size-7 text-zinc-600 mx-auto mb-2.5" />
              <p className="text-sm text-zinc-500 mb-4">
                No generations yet — pick a tool above to start.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ── Fixed bottom composer bar ──────────────────────────────────── */}
      <BottomComposer />
    </main>
  );
}

// ── Tool card ─────────────────────────────────────────────────────────────

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <Link
      to={tool.to}
      className="group flex flex-col rounded-2xl border border-white/[0.08] p-4 no-underline transition-all hover:border-white/[0.14] active:scale-[0.97]"
      style={{ background: "oklch(0.11 0.015 272)" }}
    >
      {/* Icon + credits row */}
      <div className="flex items-start justify-between mb-3">
        <span
          className="flex size-9 items-center justify-center rounded-xl"
          style={{ background: "oklch(0.16 0.02 272)" }}
        >
          <tool.icon className="size-4 text-zinc-300" />
        </span>
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: "#60a5fa" }}>
          {tool.creditDisplay ?? tool.credits} •
        </span>
      </div>

      {/* Name + description */}
      <p className="text-[13px] font-semibold text-zinc-100 leading-tight">
        {tool.label}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-zinc-500">
        {tool.tagline}
      </p>

      {/* CREATE → */}
      <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors">
        CREATE <ArrowRight className="size-3" />
      </div>
    </Link>
  );
}

// ── Recent card ──────────────────────────────────────────────────────────

type GenItem = {
  id: string;
  kind?: string | null;
  prompt?: string | null;
  status?: string | null;
  result_image_url?: string | null;
  result_video_url?: string | null;
  created_at?: string | null;
};

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

function RecentCard({ g }: { g: GenItem }) {
  const badge = KIND_BADGE[g.kind ?? "image"] ?? null;
  const ago   = timeAgo(g.created_at);

  return (
    <article>
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/60">
        {g.result_image_url ? (
          <img
            src={g.result_image_url}
            alt={g.prompt?.slice(0, 50) ?? ""}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : g.result_video_url ? (
          <AutoplayVideo
            src={g.result_video_url}
            className="h-full w-full object-cover"
            playsInline
            loop
            autoPlay={false}
            onMouseEnter={(e) => e.currentTarget.play()}
            onMouseLeave={(e) => e.currentTarget.pause()}
          />
        ) : null}

        {/* Category badge — top left */}
        {badge && (
          <span
            className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white"
            style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(6px)" }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Name + time */}
      <div className="mt-1.5 px-0.5">
        <p className="text-[11px] font-medium text-zinc-300 leading-tight line-clamp-1">
          {g.prompt?.slice(0, 36) || badge || "Generation"}
        </p>
        {ago && (
          <p className="mt-0.5 text-[10px] text-zinc-600">{ago}</p>
        )}
      </div>
    </article>
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
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, oklch(0.58 0.22 25 / 0.4) 50%, transparent 100%)",
        }}
      />

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-4 pt-3 pb-1"
      >
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
