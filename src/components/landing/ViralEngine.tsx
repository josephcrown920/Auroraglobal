import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Flame,
  Sparkles,
  TrendingUp,
  Zap,
  Video,
  ArrowRight,
  Play,
  Film,
  Image as ImageIcon,
  Mic2,
} from "lucide-react";
import { SPIN_COUNT, SPIN_CONTENT_TYPES } from "@/lib/spin-engine";
import { CATEGORY_ORDER } from "@/lib/template-studio";

// Single source of truth — matches what the Spin backend actually ships.
const COUNT: number = SPIN_COUNT;

// ─── Canonical label derivation ────────────────────────────────────────────
// Every tile badge must trace to either SPIN_CONTENT_TYPES or CATEGORY_ORDER
// so labels can never drift from what Aurora actually produces.

type SpinType     = typeof SPIN_CONTENT_TYPES[number];
type CategoryType = typeof CATEGORY_ORDER[number];

// Strip trailing descriptor words to get a short display label.
// "Carousel cover" → "Carousel", "Lip-sync clip" → "Lip-sync", etc.
const SPIN_LABEL: Record<SpinType, string> = Object.fromEntries(
  SPIN_CONTENT_TYPES.map((t) => [
    t,
    t.replace(/ (hook|clip|cover|post|visual|edit|scenario|scenes)$/i, "").trim(),
  ]),
) as Record<SpinType, string>;

// Template-category short labels for tiles that map to a STUDIO_TEMPLATES
// category rather than a Spin content type.
const CAT_LABEL: Partial<Record<CategoryType, string>> = {
  "Lip-sync": "Lip-sync",
  "Motion":   "Motion reel",
  "UGC/Ad":   "UGC ad",
  "Spin":     "TikTok30",
};

function deriveFmt(contentType: SpinType | CategoryType): string {
  if ((SPIN_CONTENT_TYPES as ReadonlyArray<string>).includes(contentType)) {
    return SPIN_LABEL[contentType as SpinType];
  }
  return CAT_LABEL[contentType as CategoryType] ?? contentType;
}

// ─── Content-type grid ─────────────────────────────────────────────────────
// Each tile's `contentType` must be a value from SPIN_CONTENT_TYPES or
// CATEGORY_ORDER — no freeform label strings allowed here. The grid spans
// both content types (what Aurora generates) and platform categories (Motion,
// UGC/Ad) to show the full range of output formats.

interface GridTile {
  contentType: SpinType | CategoryType;
  aspect: string;
  src: string;
  isVideo: boolean;
}

const GRID_TILES: GridTile[] = [
  { contentType: "Talking-head hook",  aspect: "9:16", src: "/josh/generated2/viral-01-lyric-hook.webp",    isVideo: false },
  { contentType: "Lip-sync clip",      aspect: "9:16", src: "/josh/generated2/viral-02-beat-sync.webp",     isVideo: true  },
  { contentType: "Story-style post",   aspect: "9:16", src: "/josh/generated2/viral-03-cover-reveal.webp",  isVideo: false },
  { contentType: "Story-style post",   aspect: "9:16", src: "/josh/generated2/viral-04-story-teaser.webp",  isVideo: false },
  { contentType: "Meme edit",          aspect: "1:1",  src: "/josh/generated2/viral-05-color-grade.webp",   isVideo: false },
  { contentType: "Talking-head hook",  aspect: "9:16", src: "/josh/generated2/viral-06-youtube-short.webp", isVideo: true  },
  { contentType: "Lip-sync",           aspect: "9:16", src: "/josh/generated2/viral-07-lipsync-clip.webp",  isVideo: true  },
  { contentType: "Carousel cover",     aspect: "1:1",  src: "/josh/generated2/viral-08-album-teaser.webp",  isVideo: false },
  { contentType: "Motion",             aspect: "9:16", src: "/josh/generated2/viral-09-vertical-poster.webp",isVideo: true  },
  { contentType: "Behind-the-scenes",  aspect: "9:16", src: "/josh/generated2/viral-10-performance.webp",   isVideo: false },
  { contentType: "Caption hook visual",aspect: "4:5",  src: "/josh/generated2/viral-11-captioned-hook.webp", isVideo: false },
  { contentType: "UGC/Ad",             aspect: "9:16", src: "/josh/generated2/viral-12-single-cover.webp",  isVideo: false },
];

// Badge colours keyed by derived label for visual variety.
const FMT_COLOR: Record<string, string> = {
  "Talking-head":  "bg-pink-500/80",
  "Lip-sync":      "bg-fuchsia-500/80",
  "Story-style":   "bg-violet-500/80",
  "Meme":          "bg-orange-500/80",
  "Carousel":      "bg-indigo-500/80",
  "Motion reel":   "bg-sky-600/80",
  "Behind-the-sc": "bg-teal-600/80",  // "Behind-the-scenes" truncated key
  "Caption hook":  "bg-teal-500/80",
  "UGC ad":        "bg-emerald-600/80",
  "TikTok30":      "bg-red-500/80",
};

function badgeColor(fmt: string): string {
  // Match on prefix so truncated keys still hit the right colour.
  const entry = Object.entries(FMT_COLOR).find(([k]) => fmt.startsWith(k));
  return entry?.[1] ?? "bg-white/20";
}

// ─── Sample hooks for the interactive demo ─────────────────────────────────
const SAMPLE_HOOKS = [
  "POV: my morning routine",
  "Day in my life as an artist",
  "Nobody talks about this",
  "3 looks, one vibe",
  "How I went viral",
];

export function ViralEngine() {
  const [hook, setHook] = useState(SAMPLE_HOOKS[0]);

  return (
    <section className="relative z-10 mx-4 md:mx-12 my-12 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#1a0822] via-[#0f0820] to-[#06070d] animate-fade-in">
      {/* Ambient glows */}
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            "radial-gradient(circle at 90% 0%, rgba(236,72,153,.28), transparent 40%), radial-gradient(circle at 0% 100%, rgba(168,85,247,.28), transparent 40%)",
        }}
      />

      <div className="relative px-6 py-10 md:px-12 md:py-14">

        {/* ── Platform badges ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-pink-200">
            <Flame className="size-3.5" /> TikTok30
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/70">
            <TrendingUp className="size-3.5" /> TikTok · Reels · Shorts · X
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-violet-300">
            <Sparkles className="size-3.5" /> Claude + Seedance 2.0
          </span>
        </div>

        {/* ── Headline ────────────────────────────────────────────── */}
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.25em] text-fuchsia-300">
          Go viral on TikTok with Aurora
        </p>
        <h2 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-white md:text-5xl">
          One prompt.{" "}
          <span className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
            {COUNT} posts. Posted.
          </span>
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
          Drop your hook. Aurora plans a full content campaign — Talking-head hooks, Lip-sync clips,
          Carousels, Stories, UGC ads — across every format, every platform, from one idea.
        </p>

        {/* ── Interactive hook demo ────────────────────────────────── */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur p-4 md:p-5">
          <label className="text-[11px] uppercase tracking-[0.2em] text-pink-200/80">
            Try it — type your hook
          </label>

          {/* Sample hook chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {SAMPLE_HOOKS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setHook(s)}
                className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                  hook === s
                    ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-200"
                    : "border-white/10 bg-white/5 text-white/55 hover:border-white/20 hover:text-white/80"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input + generate action */}
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder="e.g. POV: my morning routine"
              className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-fuchsia-400/50 focus:ring-1 focus:ring-fuchsia-400/30 transition-colors"
            />
            <Link
              to="/spin"
              search={{ prompt: hook || undefined, jobId: undefined }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white no-underline shadow-lg shadow-fuchsia-500/30 hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Generate <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* ── Content-type grid ────────────────────────────────────── */}
        {/* Every fmt badge is derived from SPIN_CONTENT_TYPES or CATEGORY_ORDER */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-[0.2em] text-pink-200/80">
              Every format Aurora ships
            </span>
            <span className="text-[11px] text-white/35">{COUNT} posts · 1 prompt</span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 md:gap-2.5">
            {GRID_TILES.map((tile, i) => {
              const fmt = deriveFmt(tile.contentType);
              return (
                <figure
                  key={`${tile.contentType}-${i}`}
                  className="group relative overflow-hidden rounded-xl bg-white/5 shadow-md shadow-black/40 transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                  style={{ aspectRatio: "1/1" }}
                >
                  <img
                    src={tile.src}
                    alt={fmt}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                  {/* Format badge — derived from canonical source */}
                  <span
                    className={`absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[8px] md:text-[9px] font-bold text-white backdrop-blur-sm ${badgeColor(fmt)}`}
                  >
                    {fmt}
                  </span>

                  {/* Media type indicator */}
                  <span className="absolute right-1.5 top-1.5 text-white/60">
                    {tile.isVideo
                      ? <Film className="size-2.5 md:size-3" />
                      : <ImageIcon className="size-2.5 md:size-3" />}
                  </span>

                  {/* Aspect ratio footer */}
                  <figcaption className="absolute inset-x-0 bottom-0 px-1.5 py-1.5">
                    <p className="text-[7px] md:text-[8px] text-white/45">{tile.aspect}</p>
                  </figcaption>
                </figure>
              );
            })}
          </div>

          {/* Results proof bar */}
          <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
            {[
              { icon: <Play className="size-3.5" />,     n: COUNT,                    l: "Posts per run"     },
              { icon: <Mic2 className="size-3.5" />,     n: SPIN_CONTENT_TYPES.length, l: "Content formats"  },
              { icon: <Sparkles className="size-3.5" />, n: CATEGORY_ORDER.length,     l: "Template categories" },
            ].map((s, i) => (
              <div
                key={s.l}
                className={`flex flex-col items-center py-3 gap-0.5 ${i > 0 ? "border-l border-white/10" : ""}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-fuchsia-300/70">{s.icon}</span>
                  <span className="text-base md:text-lg font-bold text-white">{s.n}</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-white/40">{s.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Feature cards ────────────────────────────────────────── */}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Feature
            icon={<Video className="size-4" />}
            title="Beat-synced cuts"
            body="Openers that hit on the downbeat — 0–3s hooks proven to stop the scroll on TikTok & Reels."
          />
          <Feature
            icon={<Mic2 className="size-4" />}
            title="Lip-sync to your track"
            body="Drop your song — Aurora aligns mouth shapes frame-perfect to your vocals every time."
          />
          <Feature
            icon={<Zap className="size-4" />}
            title={`${COUNT} formats, one click`}
            body="Talking-head hooks, Stories, Carousels, UGC ads, Motion reels — every format in one campaign."
          />
        </div>

        {/* ── CTAs ─────────────────────────────────────────────────── */}
        {/* Primary → Aurora Studio; Secondary → UGC Factory */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-500 px-6 py-3 text-sm font-bold text-white no-underline shadow-lg shadow-fuchsia-500/30 hover:opacity-95 transition-opacity"
          >
            Open Spin Studio · 1 → {COUNT} <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/ugc"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white no-underline hover:bg-white/10 transition-colors"
          >
            <Film className="size-4" /> UGC Factory
          </Link>
        </div>
      </div>
    </section>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-pink-200">
        {icon}
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <p className="mt-1 text-sm text-white/65">{body}</p>
    </div>
  );
}
