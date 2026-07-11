import { Link } from "@tanstack/react-router";
import {
  Flame,
  Sparkles,
  TrendingUp,
  Zap,
  Video,
  ArrowRight,
  Music,
  Users,
  Play,
} from "lucide-react";
import { SPIN_COUNT } from "@/lib/spin-engine";

// One creator, many posts — every tile is a UNIQUE identity-locked shot of the
// same artist (Josh) in a different outfit/scene, proving "one photo in, many
// posts out." Generated 2026-07 via Gemini identity edit from the reference
// selfie; files live in public/josh/generated2/.
const PIECES = [
  { label: "Lyric video hook", src: "/josh/generated2/viral-01-lyric-hook.webp" },
  { label: "Beat-sync visual", src: "/josh/generated2/viral-02-beat-sync.webp" },
  { label: "Cover art reveal", src: "/josh/generated2/viral-03-cover-reveal.webp" },
  { label: "Story teaser", src: "/josh/generated2/viral-04-story-teaser.webp" },
  { label: "Color-grade variant", src: "/josh/generated2/viral-05-color-grade.webp" },
  { label: "YouTube Short", src: "/josh/generated2/viral-06-youtube-short.webp" },
  { label: "Lip-sync clip", src: "/josh/generated2/viral-07-lipsync-clip.webp" },
  { label: "Album teaser", src: "/josh/generated2/viral-08-album-teaser.webp" },
  { label: "Vertical poster", src: "/josh/generated2/viral-09-vertical-poster.webp" },
  { label: "Performance clip", src: "/josh/generated2/viral-10-performance.webp" },
  { label: "Captioned hook", src: "/josh/generated2/viral-11-captioned-hook.webp" },
  { label: "Single cover", src: "/josh/generated2/viral-12-single-cover.webp" },
] as const;

// Single source of truth for the post count — matches the real Spin backend
// (SPIN_COUNT) so the landing page never advertises a number the product
// doesn't deliver.
const COUNT: number = SPIN_COUNT;

export function ViralEngine() {
  return (
    <section className="relative z-10 mx-4 md:mx-12 my-12 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#1a0822] via-[#0f0820] to-[#06070d] animate-fade-in">
      <div
        className="absolute inset-0 pointer-events-none opacity-50"
        style={{
          background:
            "radial-gradient(circle at 90% 0%, rgba(236,72,153,.28), transparent 40%), radial-gradient(circle at 0% 100%, rgba(168,85,247,.28), transparent 40%)",
        }}
      />
      <div className="relative px-6 py-10 md:px-12 md:py-14">
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

        <p className="mt-4 text-sm font-bold uppercase tracking-[0.25em] text-fuchsia-300">
          Promote your music with AI
        </p>
        <h2 className="mt-2 max-w-3xl text-3xl font-extrabold tracking-tight text-white md:text-5xl">
          One prompt.{" "}
          <span className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
            {COUNT} posts. Posted.
          </span>
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
          Type your hook. Aurora uses <strong className="text-white">Claude + Seedance 2.0</strong> to generate{" "}
          <strong className="text-white">{COUNT} scroll-stopping posts</strong> — lyric hooks, cover reveals,
          performance clips, styled portraits — a full month of content from one idea.
        </p>

        {/* Plain photo collage — every post type Aurora ships, at a glance */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-black/50 backdrop-blur p-4 md:p-5">
          <label className="text-[11px] uppercase tracking-[0.2em] text-pink-200/80">
            Every post type, one prompt
          </label>

          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 md:gap-3">
            {PIECES.map((piece) => (
              <figure
                key={piece.label}
                className="group relative overflow-hidden rounded-xl bg-white/5 shadow-md shadow-black/40 transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                style={{ aspectRatio: "4/5" }}
              >
                <img
                  src={piece.src}
                  alt={piece.label}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-1.5">
                  <p className="text-[9px] md:text-[10px] font-semibold text-white leading-tight line-clamp-2">
                    {piece.label}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>

          {/* Results proof bar */}
          <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
            {[
              { icon: <Play className="size-3.5" />, n: "6.1M", l: "Views" },
              { icon: <Users className="size-3.5" />, n: "21K", l: "New followers" },
              { icon: <Sparkles className="size-3.5" />, n: `${COUNT}`, l: "Posts shipped" },
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

        {/* Feature stack */}
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Feature
            icon={<Video className="size-4" />}
            title="Beat-synced cuts"
            body="Openers that hit on the downbeat — 0–3s hooks proven to stop the scroll on TikTok & Reels."
          />
          <Feature
            icon={<Sparkles className="size-4" />}
            title="Genre-ready aesthetics"
            body="Afrobeats, Trap, Drill, neon and Y2K looks — color-grade swaps in one tap."
          />
          <Feature
            icon={<Zap className="size-4" />}
            title="Lip-sync to your track"
            body="Drop your song — Aurora aligns mouth shapes frame-perfect to your vocals."
          />
        </div>

        {/* Two CTAs — primary render action + secondary proof action */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to="/spin"
            search={{ prompt: undefined, jobId: undefined }}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-500 px-6 py-3 text-sm font-bold text-white no-underline shadow-lg shadow-fuchsia-500/30 hover:opacity-95"
          >
            Open Spin Studio · 1 → {COUNT} <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/gallery"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-bold text-white no-underline hover:bg-white/10"
          >
            <Music className="size-4" /> See real examples
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
