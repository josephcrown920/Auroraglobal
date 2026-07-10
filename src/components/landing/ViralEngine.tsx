import { Link } from "@tanstack/react-router";
import {
  Flame,
  Sparkles,
  TrendingUp,
  Zap,
  Video,
  Image as ImageIcon,
  ArrowRight,
  Music,
  Users,
  Play,
} from "lucide-react";
import { SPIN_COUNT } from "@/lib/spin-engine";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";
// One creator, many posts — the grid tiles cycle the SAME artist identity
// across different real Spin-style looks, proving "one photo in, many posts out."
// NOTE: josh-pink-sideprofile removed at user request.
import joshMoodyMic from "@/assets/josh/josh-moody-mic.jpg.asset.json";
import joshColorsSession from "@/assets/josh/josh-colors-session.png.asset.json";
import joshNeonSeated from "@/assets/josh/josh-neon-seated.png.asset.json";

const GRID_PHOTOS = [
  joshColorsSession.url,
  joshNeonSeated.url,
  joshMoodyMic.url,
] as const;

// Accurate full-color TikTok logo (official glyph, layered cyan/red/white).
function TikTokLogo({ className }: { className?: string }) {
  const d =
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z";
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="TikTok">
      <path d={d} transform="translate(-0.7,-0.7)" fill="#25F4EE" />
      <path d={d} transform="translate(0.7,0.7)" fill="#FE2C55" />
      <path d={d} fill="#FFFFFF" />
    </svg>
  );
}

const PIECES = [
  { label: "Lyric video hook", kind: "video", color: "from-pink-500 to-rose-500" },
  { label: "Beat-sync visual", kind: "video", color: "from-fuchsia-500 to-pink-500" },
  { label: "Cover art reveal", kind: "image", color: "from-violet-500 to-fuchsia-500" },
  { label: "Story teaser", kind: "image", color: "from-emerald-500 to-teal-500" },
  { label: "Color-grade variant", kind: "image", color: "from-cyan-400 to-sky-500" },
  { label: "YouTube Short", kind: "video", color: "from-red-500 to-orange-500" },
  { label: "Lip-sync clip", kind: "video", color: "from-pink-500 to-violet-500" },
  { label: "Album teaser", kind: "image", color: "from-yellow-400 to-amber-500" },
  { label: "Vertical poster", kind: "image", color: "from-purple-500 to-violet-600" },
  { label: "Performance clip", kind: "video", color: "from-rose-500 to-pink-500" },
  { label: "Captioned hook", kind: "image", color: "from-fuchsia-400 to-purple-500" },
  { label: "Single cover", kind: "image", color: "from-blue-500 to-indigo-500" },
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
        {/* TikTok × Aurora pulsing lockup — real logos */}
        <div className="mb-6 flex items-center justify-center gap-5">
          {/* Actual TikTok logo */}
          <div className="relative grid place-items-center">
            <span className="absolute inset-0 rounded-2xl bg-pink-500/40 blur-2xl animate-pulse" />
            <div className="relative grid size-12 md:size-14 place-items-center rounded-2xl bg-black shadow-lg shadow-pink-500/30">
              <TikTokLogo className="size-7 md:size-8" />
            </div>
          </div>
          <span className="text-2xl md:text-3xl font-black text-white/60">×</span>
          {/* Actual Aurora logo */}
          <div className="relative grid place-items-center">
            <span className="absolute inset-0 rounded-2xl bg-fuchsia-500/40 blur-2xl animate-pulse [animation-delay:300ms]" />
            <div className="relative grid size-12 md:size-14 place-items-center overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 shadow-lg shadow-fuchsia-500/40">
              <img
                src={auroraLogo.url}
                alt="Aurora"
                loading="lazy"
                decoding="async"
                className="size-full object-contain p-1.5"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-pink-200">
            <Flame className="size-3.5" /> Spin 30
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

        {/* Flat content-type grid — every post type Aurora ships, at a glance */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-black/50 backdrop-blur p-4 md:p-5">
          <label className="text-[11px] uppercase tracking-[0.2em] text-pink-200/80">
            Every post type, one prompt
          </label>

          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 md:gap-2">
            {PIECES.map((piece, i) => (
              <div
                key={piece.label}
                className="relative overflow-hidden rounded-[14px] border border-white/10"
                style={{ aspectRatio: "9/16" }}
              >
                <img
                  src={GRID_PHOTOS[i % GRID_PHOTOS.length]}
                  alt={piece.label}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className={`absolute inset-0 bg-gradient-to-t ${piece.color} opacity-30`} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/25" />

                <div className="absolute top-1.5 left-1.5">
                  {piece.kind === "video" ? (
                    <Video className="size-3 text-white drop-shadow-sm" />
                  ) : (
                    <ImageIcon className="size-3 text-white drop-shadow-sm" />
                  )}
                </div>

                <div className="absolute bottom-1.5 right-1.5">
                  <TikTokLogo className="size-3 opacity-50" />
                </div>

                <div className="absolute inset-x-0 bottom-0 p-1.5">
                  <p className="text-[9px] md:text-[10px] font-black text-white leading-tight line-clamp-2">
                    {piece.label}
                  </p>
                </div>
              </div>
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
