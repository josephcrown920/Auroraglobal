import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Flame, Sparkles, TrendingUp, Zap, Video, Play, RotateCcw, ArrowRight, Check } from "lucide-react";

const PIECES = [
  { label: "9:16 TikTok hook",      kind: "video",    color: "from-pink-500 to-rose-500" },
  { label: "Reels cold-open",       kind: "video",    color: "from-fuchsia-500 to-pink-500" },
  { label: "YouTube Short",         kind: "video",    color: "from-red-500 to-orange-500" },
  { label: "X video post",          kind: "video",    color: "from-zinc-500 to-zinc-700" },
  { label: "Carousel cover",        kind: "image",    color: "from-violet-500 to-fuchsia-500" },
  { label: "Carousel slide 2",      kind: "image",    color: "from-violet-400 to-indigo-500" },
  { label: "Carousel slide 3",      kind: "image",    color: "from-indigo-500 to-blue-500" },
  { label: "Story teaser",          kind: "video",    color: "from-pink-400 to-fuchsia-500" },
  { label: "Story poll",            kind: "image",    color: "from-emerald-500 to-teal-500" },
  { label: "Behind-the-scenes",     kind: "video",    color: "from-amber-500 to-orange-500" },
  { label: "Lip-sync clip",         kind: "lipsync",  color: "from-pink-500 to-violet-500" },
  { label: "Color-grade variant",   kind: "image",    color: "from-cyan-400 to-sky-500" },
  { label: "Quote graphic",         kind: "image",    color: "from-slate-500 to-zinc-600" },
  { label: "Meme remix",            kind: "image",    color: "from-yellow-400 to-amber-500" },
  { label: "Talking-head cut",      kind: "video",    color: "from-rose-500 to-pink-500" },
  { label: "Captioned hook",        kind: "video",    color: "from-fuchsia-400 to-purple-500" },
  { label: "Vertical poster",       kind: "image",    color: "from-purple-500 to-violet-600" },
  { label: "Square poster",         kind: "image",    color: "from-blue-500 to-indigo-500" },
  { label: "Pinterest pin",         kind: "image",    color: "from-red-400 to-rose-500" },
  { label: "Thread cover",          kind: "image",    color: "from-zinc-400 to-zinc-600" },
  { label: "Email header",          kind: "image",    color: "from-emerald-400 to-cyan-500" },
  { label: "Newsletter GIF",        kind: "video",    color: "from-teal-400 to-emerald-500" },
  { label: "Threads quote",         kind: "image",    color: "from-zinc-300 to-zinc-500" },
  { label: "B-roll loop",           kind: "video",    color: "from-orange-400 to-red-500" },
  { label: "Slow-mo cut",           kind: "video",    color: "from-sky-400 to-blue-500" },
  { label: "Zoom-punch edit",       kind: "video",    color: "from-fuchsia-500 to-rose-500" },
  { label: "Text-overlay v1",       kind: "image",    color: "from-pink-300 to-fuchsia-400" },
  { label: "Text-overlay v2",       kind: "image",    color: "from-violet-400 to-pink-400" },
  { label: "Endcard CTA",           kind: "image",    color: "from-amber-400 to-pink-500" },
  { label: "Cover frame",           kind: "image",    color: "from-cyan-300 to-violet-400" },
] as const;

const SAMPLE_HOOKS = [
  "POV: my first single just dropped",
  "He thought it was just a photoshoot…",
  "How I made this in 30 seconds with Aurora",
  "Trying the viral neon-cyc trend",
];

export function ViralEngine() {
  const navigate = useNavigate();
  const [hook, setHook] = useState("");
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef<number | null>(null);

  const startSpin = (text?: string) => {
    const value = (text ?? hook).trim() || SAMPLE_HOOKS[Math.floor(Math.random() * SAMPLE_HOOKS.length)];
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
    }, 110);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [phase]);

  const goToSpin = () => {
    const value = hook.trim();
    if (value) {
      navigate({ to: "/spin", search: { prompt: value } });
    } else {
      navigate({ to: "/spin" });
    }
  };

  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#1a0822] via-[#0f0820] to-[#06070d] animate-fade-in">
      <div className="absolute inset-0 pointer-events-none opacity-50" style={{ background: "radial-gradient(circle at 90% 0%, rgba(236,72,153,.28), transparent 40%), radial-gradient(circle at 0% 100%, rgba(168,85,247,.28), transparent 40%)" }} />
      <div className="relative px-6 py-14 md:px-12 md:py-20">
        {/* TikTok × Aurora pulsing lockup */}
        <div className="mb-8 flex items-center justify-center gap-5">
          {/* TikTok logo (official mark, recreated in SVG) */}
          <div className="relative grid place-items-center">
            <span className="absolute inset-0 rounded-2xl bg-pink-500/40 blur-2xl animate-pulse" />
            <svg viewBox="0 0 48 48" className="relative size-14 md:size-16" aria-label="TikTok">
              <path fill="#25F4EE" d="M33.6 8.5c.6 3.6 2.6 6.3 6.4 7.2v6.1c-2.6.2-4.9-.5-7.6-2.2v9.7c0 5.9-3.1 10.7-9.2 11.5-6 .8-11.3-3.6-12.1-9.6-.7-5.9 3.6-11.3 9.5-12.1v6.5c-1.6.1-2.9 1.5-2.9 3.1 0 1.7 1.4 3.1 3.1 3.1 1.7 0 3.1-1.4 3.1-3.1V8.5h9.7z" transform="translate(-2 -1)"/>
              <path fill="#FE2C55" d="M35.6 6.5c.6 3.6 2.6 6.3 6.4 7.2v6.1c-2.6.2-4.9-.5-7.6-2.2v9.7c0 5.9-3.1 10.7-9.2 11.5-6 .8-11.3-3.6-12.1-9.6-.7-5.9 3.6-11.3 9.5-12.1v6.5c-1.6.1-2.9 1.5-2.9 3.1 0 1.7 1.4 3.1 3.1 3.1 1.7 0 3.1-1.4 3.1-3.1V6.5h9.7z" transform="translate(-2 -1)"/>
              <path fill="#fff" d="M34.6 7.5c.6 3.6 2.6 6.3 6.4 7.2v6.1c-2.6.2-4.9-.5-7.6-2.2v9.7c0 5.9-3.1 10.7-9.2 11.5-6 .8-11.3-3.6-12.1-9.6-.7-5.9 3.6-11.3 9.5-12.1v6.5c-1.6.1-2.9 1.5-2.9 3.1 0 1.7 1.4 3.1 3.1 3.1 1.7 0 3.1-1.4 3.1-3.1V7.5h9.7z" transform="translate(-2 -1)"/>
            </svg>
          </div>
          <span className="text-2xl md:text-3xl font-black text-white/60">×</span>
          {/* Aurora logo */}
          <div className="relative grid place-items-center">
            <span className="absolute inset-0 rounded-2xl bg-fuchsia-500/40 blur-2xl animate-pulse [animation-delay:300ms]" />
            <div className="relative size-14 md:size-16 rounded-2xl bg-gradient-to-br from-pink-400 via-fuchsia-500 to-violet-500 grid place-items-center shadow-lg shadow-fuchsia-500/40">
              <span className="text-white font-black text-xl md:text-2xl tracking-tight">A</span>
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

        <h2 className="mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-white md:text-6xl">
          Go viral on TikTok <span className="bg-gradient-to-r from-pink-300 via-fuchsia-300 to-violet-300 bg-clip-text text-transparent">with Aurora.</span>
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/72 md:text-lg">
          One idea in. <strong className="text-white">30 scroll-stopping pieces out.</strong> Aurora cuts, recolors, re-angles, lip-syncs and re-captions your content into a full week of posts — built for the For You page.
        </p>

        {/* Inline interactive 1 → 30 demo */}
        <div className="mt-10 rounded-3xl border border-white/10 bg-black/50 backdrop-blur p-5 md:p-6">
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
                placeholder="POV: my first single just dropped"
                className="flex-1 rounded-full bg-white/[0.06] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus:border-pink-300/60 focus:bg-white/[0.08]"
              />
              {phase === "spinning" ? (
                <button
                  disabled
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-bold text-white/70"
                >
                  <Sparkles className="size-4 animate-spin" />
                  Spinning {revealed}/30
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
                  Spin 1 → 30
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

          {/* 30-piece grid */}
          <div className="mt-5 grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {PIECES.map((p, i) => {
              const isRevealed = i < revealed;
              const isDone = phase === "done";
              return (
                <div
                  key={p.label}
                  className={`relative aspect-[3/4] rounded-lg overflow-hidden border transition-all duration-300 ${
                    isRevealed || isDone
                      ? "border-white/20 opacity-100 scale-100"
                      : "border-white/5 opacity-30 scale-[0.97]"
                  }`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${p.color} ${
                      isRevealed || isDone ? "" : "grayscale"
                    }`}
                  />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
                  {(isRevealed || isDone) && (
                    <span className="absolute top-1 right-1 size-4 grid place-items-center rounded-full bg-black/50 text-white animate-fade-in">
                      <Check className="size-2.5" />
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                    <p className="text-[9px] uppercase tracking-wider text-white/55 leading-none">
                      {p.kind}
                    </p>
                    <p className="text-[10px] font-semibold text-white leading-tight truncate">
                      {p.label}
                    </p>
                  </div>
                  {!isRevealed && phase === "spinning" && i === revealed && (
                    <div className="absolute inset-0 bg-white/10 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>

          {phase === "done" && (
            <div className="mt-5 rounded-2xl border border-pink-300/30 bg-pink-300/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <p className="text-sm text-white">
                <strong className="text-pink-200">30 pieces ready</strong> from "{hook}". Open the studio to render them for real.
              </p>
              <button
                onClick={goToSpin}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/30 hover:opacity-95"
              >
                Render for real <ArrowRight className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* Feature stack */}
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <Feature icon={<Video className="size-4" />} title="Hook-first cuts" body="Auto-generated 0–3s openers proven to stop the scroll on TikTok & Reels." />
          <Feature icon={<Sparkles className="size-4" />} title="Trend-ready aesthetics" body="Colors studio, neon, Y2K, jersey-core, color-grade swaps in one tap." />
          <Feature icon={<Zap className="size-4" />} title="Lip-sync to any sound" body="Drop a trending audio — Aurora aligns mouth shapes frame-perfect." />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/spin"
            search={hook.trim() ? { prompt: hook.trim() } : undefined}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-400 to-fuchsia-500 px-6 py-3 text-sm font-bold text-white no-underline shadow-lg shadow-fuchsia-500/30 hover:opacity-95"
          >
            Open Spin Studio
          </Link>
          <Link to="/ugc" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white no-underline hover:bg-white/10">
            Open the UGC factory
          </Link>
        </div>
      </div>
    </section>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2 text-pink-200">{icon}<span className="text-sm font-semibold text-white">{title}</span></div>
      <p className="mt-1 text-sm text-white/65">{body}</p>
    </div>
  );
}