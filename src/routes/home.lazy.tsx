import { createLazyFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ChevronRight,
  History,
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  Sparkles,
  Terminal,
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

// Idea starters — clicking one fills the composer; submit carries the text to
// the studio (image mode) or Motion Control (video mode). Every prompt maps to
// something Aurora genuinely renders today.
const IDEA_CHIPS = [
  { id: "performance", label: "Performance shot", prompt: "Ultra-realistic live performance shot, professional stage lighting, magazine quality" },
  { id: "music-video", label: "Music video still", prompt: "Cinematic music video still, dramatic lighting, music artist style" },
  { id: "cover", label: "Album cover", prompt: "Album cover artwork, bold graphic composition, striking single subject" },
  { id: "editorial", label: "Editorial look", prompt: "High fashion editorial photograph, magazine style, artistic composition" },
  { id: "grwm", label: "GRWM outfit swap", prompt: "Get ready with me style selfie video, mirror lighting, outfit focus" },
] as const;

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
              to="/cli"
              aria-label="Aurora CLI & MCP setup"
              title="Aurora CLI & MCP"
              className="rounded-xl p-1.5 text-foreground"
            >
              <Terminal className="size-6" strokeWidth={1.8} />
            </Link>
            <Link to="/gallery" aria-label="Your gallery" className="relative rounded-xl p-1.5 text-foreground">
              <History className="size-6" strokeWidth={1.8} />
              {reels.length > 0 ? (
                <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-dot" />
              ) : null}
            </Link>
          </div>
        </header>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <div className="mt-7 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Sparkles className="size-4 text-brand-ink" />
          <span>Aurora · AI Creative Studio</span>
        </div>
        <h1 className="mt-3 text-[38px] font-extrabold leading-[1.08] tracking-tight text-foreground">
          <EditableCopy copyKey="home_capcut_headline" fallback="Film yourself" />{" "}
          <span className="text-brand-ink">
            <EditableCopy copyKey="home_capcut_headline_accent" fallback="anywhere." />
          </span>
        </h1>

        {/* ── Reels card: your latest renders ────────────────────────────── */}
        <section className="mt-6 rounded-3xl bg-card p-2.5 shadow-[var(--shadow-card)]">
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
