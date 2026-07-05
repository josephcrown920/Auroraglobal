import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Flame,
  Sparkles,
  TrendingUp,
  Zap,
  Video,
  Play,
  RotateCcw,
  ArrowRight,
  ChevronLeft,
  Bell,
  Forward,
  MessageCircle,
  BadgeCheck,
  LayoutGrid,
  Repeat2,
  UserPlus,
  Signal,
  Wifi,
  BatteryFull,
} from "lucide-react";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";
// One creator, many posts — the whole grid is the SAME female avatar identity.
// Aurora recolors, re-angles and re-captions one reference into a full feed.
import creatorAvatar from "@/assets/ugc-avatar-1.jpg";

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

const COUNT = PIECES.length;

// Per-tile view counts, captions, and framing so one face reads as a full feed.
const VIEWS = [
  "1.2M",
  "845K",
  "2.1M",
  "96K",
  "540K",
  "1.9M",
  "430K",
  "72K",
  "688K",
  "910K",
  "28.4K",
  "1.1M",
] as const;

const CAPTIONS = [
  "POV: my single dropped 🎤",
  "cover art reveal 🎨",
  "made this in 30s 🤯",
  "beat drop at 0:08 🔊",
  "neon color grade ✨",
  "lyric video hook 🎬",
  "lip-sync to my track 🎵",
  "when the beat drops 😳",
  "album teaser 🔥",
  "performance clip, zero setup",
  "auto-captioned lyrics 💬",
  "single cover 🖼️",
] as const;

const POSITIONS = ["50% 20%", "50% 42%", "42% 30%", "58% 32%", "50% 30%", "50% 16%"] as const;

const SAMPLE_HOOKS = [
  "POV: my single just charted",
  "beat drop at 0:08 hits different",
  "Afrobeats summer anthem 2025",
  "how I made my music video in 30s",
];

export function ViralEngine() {
  const navigate = useNavigate();
  const [hook, setHook] = useState("");
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef<number | null>(null);

  const startSpin = (text?: string) => {
    const value =
      (text ?? hook).trim() || SAMPLE_HOOKS[Math.floor(Math.random() * SAMPLE_HOOKS.length)];
    setHook(value);
    setRevealed(0);
    setPhase("spinning");
  };

  const reset = () => {
    setPhase("idle");
    setRevealed(0);
  };

  useEffect(() => {
    if (phase !== "spinning") return;
    let i = 0;
    timerRef.current = window.setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= PIECES.length) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        setPhase("done");
      }
    }, 140);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [phase]);

  const goToSpin = () => {
    const value = hook.trim();
    if (value) {
      navigate({ to: "/spin", search: { prompt: value, jobId: undefined } });
    } else {
      navigate({ to: "/spin", search: { prompt: undefined, jobId: undefined } });
    }
  };

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
            <Flame className="size-3.5" /> Viral engine
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/70">
            <TrendingUp className="size-3.5" /> TikTok · Reels · Shorts · X
          </span>
        </div>

        <h2 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white md:text-5xl">
          Drop your song,{" "}
          <span className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">
            go viral in 30 secs
          </span>
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
          One track in. <strong className="text-white">{COUNT} scroll-stopping pieces out.</strong>{" "}
          Aurora cuts lyric hooks, syncs visuals to your beat, reveals your cover art and lip-syncs
          your face into a full week of posts — built for the For You page.
        </p>

        {/* Inline interactive 1 → N demo */}
        <div className="mt-6 rounded-3xl border border-white/10 bg-black/50 backdrop-blur p-4 md:p-5">
          <div className="flex flex-col gap-3">
            <label className="text-[11px] uppercase tracking-[0.2em] text-pink-200/80">
              Try it · type a hook idea
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    startSpin();
                  }
                }}
                placeholder="POV: my single just charted"
                className="flex-1 rounded-full bg-white/[0.06] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-pink-300/60 focus:bg-white/[0.08]"
              />
              {phase === "spinning" ? (
                <button
                  disabled
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white/70"
                >
                  <Sparkles className="size-4 animate-spin" />
                  Spinning {revealed}/{COUNT}
                </button>
              ) : phase === "done" ? (
                <button
                  onClick={reset}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
                >
                  <RotateCcw className="size-4" />
                  Reset
                </button>
              ) : (
                <button
                  onClick={() => startSpin()}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-95"
                >
                  <Play className="size-4 fill-white" />
                  Spin 1 → {COUNT}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_HOOKS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => startSpin(h)}
                  className="text-[11px] rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/65 hover:text-white hover:border-pink-300/40 hover:bg-pink-300/10"
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* TikTok profile mockup — one creator, a whole feed */}
          <div className="mt-5 mx-auto w-full max-w-[380px]">
            <div className="relative overflow-hidden rounded-[44px] border-[10px] border-black bg-black shadow-2xl shadow-fuchsia-900/40">
              {/* dynamic-island pill */}
              <div className="absolute left-1/2 top-2 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
              <div className="relative bg-black text-white">
                {/* status bar */}
                <div className="flex items-center justify-between px-6 pb-1 pt-2.5 text-[11px] font-semibold">
                  <span>9:41</span>
                  <div className="flex items-center gap-1.5 text-white/85">
                    <Signal className="size-3.5" />
                    <Wifi className="size-3.5" />
                    <BatteryFull className="size-4" />
                  </div>
                </div>
                {/* top nav */}
                <div className="flex items-center justify-between px-4 py-2 text-white/90">
                  <ChevronLeft className="size-5" />
                  <div className="flex items-center gap-4">
                    <Bell className="size-5" />
                    <Forward className="size-5" />
                  </div>
                </div>

                {/* profile header */}
                <div className="flex flex-col items-center px-4">
                  <div className="size-[92px] overflow-hidden rounded-full ring-2 ring-white/15">
                    <img
                      src={creatorAvatar}
                      alt="Aurora creator"
                      loading="lazy"
                      decoding="async"
                      className="size-full object-cover"
                      style={{ objectPosition: "50% 28%" }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[17px] font-bold">
                    aurora.creator
                    <BadgeCheck className="size-4 text-sky-400" />
                  </div>
                  <div className="text-[13px] text-white/55">@aurora.creator · she/her</div>

                  {/* stats */}
                  <div className="mt-3 flex items-center gap-5">
                    <Stat n="128" l="Following" />
                    <span className="h-6 w-px bg-white/12" />
                    <Stat n="894K" l="Followers" />
                    <span className="h-6 w-px bg-white/12" />
                    <Stat n="12.4M" l="Likes" />
                  </div>

                  {/* actions */}
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#fe2c55] px-6 py-2 text-[13px] font-semibold text-white">
                      <UserPlus className="size-4" /> Follow
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/12 px-5 py-2 text-[13px] font-semibold text-white">
                      <MessageCircle className="size-4" /> Message
                    </span>
                  </div>

                  {/* bio */}
                  <p className="mt-3 text-center text-[12.5px] leading-snug text-white/85">
                    same face, every post 🎬
                    <br />
                    made in 30s with Aurora ✨
                  </p>
                </div>

                {/* tabs */}
                <div className="mt-3 grid grid-cols-2 border-b border-white/10 text-white/50">
                  <div className="flex justify-center border-b-2 border-white pb-2 text-white">
                    <LayoutGrid className="size-5" />
                  </div>
                  <div className="flex justify-center pb-2">
                    <Repeat2 className="size-5" />
                  </div>
                </div>

                {/* video grid — one creator, a whole feed */}
                <div className="grid grid-cols-3 gap-[2px] bg-black pb-2">
                  {PIECES.map((p, i) => {
                    const lit = i < revealed || phase === "done";
                    const isCurrent = phase === "spinning" && i === revealed;
                    return (
                      <div
                        key={p.label}
                        className="relative aspect-[3/4] overflow-hidden bg-neutral-900"
                      >
                        <img
                          src={creatorAvatar}
                          alt={p.label}
                          loading="lazy"
                          className={`absolute inset-0 size-full object-cover transition-all duration-300 ${
                            lit ? "opacity-100 saturate-100" : "opacity-25 saturate-50"
                          }`}
                          style={{ objectPosition: POSITIONS[i % POSITIONS.length] }}
                        />
                        {/* color-grade tint (recolor) */}
                        <div
                          className={`absolute inset-0 bg-gradient-to-t ${p.color} mix-blend-soft-light transition-opacity duration-300 ${
                            lit ? "opacity-30" : "opacity-0"
                          }`}
                        />
                        {lit && (
                          <>
                            <p className="absolute inset-x-1 top-1 line-clamp-2 text-[8px] font-semibold leading-tight text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] animate-fade-in">
                              {CAPTIONS[i]}
                            </p>
                            <div className="absolute bottom-1 left-1 flex items-center gap-0.5 text-[9px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                              <Play className="size-2.5 fill-white" />
                              {VIEWS[i]}
                            </div>
                          </>
                        )}
                        {isCurrent && (
                          <div className="absolute inset-0 grid place-items-center bg-white/5">
                            <Sparkles className="size-4 animate-spin text-white/60" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {phase === "done" && (
            <div className="mt-5 rounded-2xl border border-pink-300/30 bg-pink-300/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <p className="text-sm text-white">
                <strong className="text-pink-200">{COUNT} pieces ready</strong> from "{hook}". Open
                the studio to see the rest and render them for real.
              </p>
              <button
                onClick={goToSpin}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-95"
              >
                See the rest in the studio <ArrowRight className="size-4" />
              </button>
            </div>
          )}
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

        {/* One primary CTA */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to="/spin"
            search={hook.trim() ? { prompt: hook.trim(), jobId: undefined } : { prompt: undefined, jobId: undefined }}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-500 px-6 py-3 text-sm font-bold text-white no-underline shadow-lg shadow-fuchsia-500/30 hover:opacity-95"
          >
            See all {COUNT} in Spin Studio <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[16px] font-bold leading-none text-white">{n}</span>
      <span className="mt-1 text-[12px] text-white/55">{l}</span>
    </div>
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
