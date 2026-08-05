import { ArrowRight, EyeOff, Lock, ShieldCheck, Sparkles, Star, Zap } from "lucide-react";

const LOOKS = [
  { label: "Boudoir",     swatch: "from-rose-600 to-rose-950",    accent: "rgba(225,29,106,0.6)" },
  { label: "Velvet",      swatch: "from-violet-600 to-violet-950", accent: "rgba(124,58,237,0.6)" },
  { label: "Golden Hour", swatch: "from-amber-500 to-amber-950",   accent: "rgba(180,83,9,0.6)" },
  { label: "Neon",        swatch: "from-fuchsia-600 to-pink-950",  accent: "rgba(219,39,119,0.6)" },
  { label: "Luxury",      swatch: "from-stone-500 to-stone-950",   accent: "rgba(146,64,14,0.6)" },
  { label: "Noir",        swatch: "from-gray-500 to-gray-950",     accent: "rgba(55,65,81,0.6)" },
  { label: "Ethereal",    swatch: "from-purple-600 to-indigo-950", accent: "rgba(109,40,217,0.6)" },
  { label: "Power",       swatch: "from-red-600 to-red-950",       accent: "rgba(190,18,60,0.6)" },
];

const FEATURES = [
  {
    icon: Lock,
    title: "Identity-Locked Shots",
    body: "Face ID technology preserves your exact facial likeness, skin tone, and hairstyle across every look — no drift, no guesswork.",
  },
  {
    icon: EyeOff,
    title: "Private by Default",
    body: "Every image is generated and stored in a private vault. Zero public indexing. Zero third-party sharing. Your content stays yours.",
  },
  {
    icon: ShieldCheck,
    title: "Watermark Built-in",
    body: "Each frame carries an embedded watermark automatically — brand every piece before it leaves your hands.",
  },
  {
    icon: Star,
    title: "8 Editorial Looks",
    body: "From boudoir editorial to film noir, velvet fantasy to golden hour — magazine-grade photoshoot styles ready in ~60 seconds.",
  },
  {
    icon: Sparkles,
    title: "8K Ultra-HD Output",
    body: "Cinema-quality resolution with ARRI-grade color science. Hyper-realistic skin texture, physically accurate lighting.",
  },
  {
    icon: Zap,
    title: "~60s Render Time",
    body: "No waiting hours. Most shots are ready in under a minute — fast enough to iterate looks in a single session.",
  },
];

interface Props { onEnter: () => void; }

export function Landing({ onEnter }: Props) {
  return (
    <div className="min-h-screen bg-[#050207] text-white antialiased overflow-x-hidden">

      {/* ── Ambient background ─────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-60 left-1/2 -translate-x-1/2 h-[700px] w-[900px] rounded-full bg-rose-900/12 blur-[160px]" />
        <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-violet-900/10 blur-[120px]" />
        <div className="absolute top-1/2 left-0 h-[350px] w-[350px] rounded-full bg-pink-900/8 blur-[100px]" />
      </div>

      {/* ── Nav ───────────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-gradient-to-br from-rose-500 to-rose-800 flex items-center justify-center shadow-[0_0_20px_rgba(225,29,106,0.5)]">
            <span className="text-[13px] font-black">A</span>
          </div>
          <span className="text-[15px] font-black tracking-tight">Adult School</span>
        </div>
        <button onClick={onEnter}
          className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-2 text-[13px] font-bold text-rose-300 transition-all hover:border-rose-500/50 hover:bg-rose-500/15">
          Operator login <ArrowRight size={13} />
        </button>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-8 pt-24 pb-16 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/8 px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-rose-400">
          <span className="size-1.5 rounded-full bg-rose-400 animate-pulse" />
          AI Photoshoot Studio · 18+
        </div>

        <h1 className="mx-auto mb-6 max-w-3xl text-[56px] font-black leading-[0.92] tracking-[-0.03em] sm:text-[72px]">
          Your content.<br />
          <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-rose-500 bg-clip-text text-transparent">
            Your identity.<br />Your control.
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-xl text-[17px] leading-relaxed text-white/45">
          AI photoshoots that lock your facial identity across every editorial look.
          Magazine-grade. Private by default. Ready in 60 seconds.
        </p>

        <button onClick={onEnter}
          className="group inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 px-8 py-4 text-[16px] font-black text-white shadow-[0_0_50px_rgba(225,29,106,0.4)] transition-all hover:shadow-[0_0_70px_rgba(225,29,106,0.6)] hover:scale-[1.02] active:scale-[0.99]">
          Enter the studio
          <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
        </button>

        <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-1.5">
          {["🔒 Private vault", "🛡 Watermarked", "🎭 Face ID lock", "⚡ ~60s results"].map(t => (
            <span key={t} className="text-[12px] text-white/25">{t}</span>
          ))}
        </div>
      </section>

      {/* ── Looks strip ───────────────────────────────────────────────────── */}
      <section className="relative z-10 mb-24 overflow-hidden">
        <div className="mb-8 text-center">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/25">8 editorial looks</div>
        </div>

        {/* Scrolling strip */}
        <div className="flex gap-4 px-8">
          {[...LOOKS, ...LOOKS].map((look, i) => (
            <div key={`${look.label}-${i}`}
              className="group relative flex-none w-[160px] overflow-hidden rounded-2xl border border-white/6 cursor-default">
              {/* Gradient swatch as stand-in for a hero image */}
              <div className={`h-[240px] bg-gradient-to-b ${look.swatch} opacity-80 group-hover:opacity-100 transition-opacity`} />
              {/* Glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: `radial-gradient(ellipse at 50% 100%, ${look.accent} 0%, transparent 65%)` }} />
              {/* Label */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="text-[12px] font-bold text-white">{look.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#050207] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#050207] to-transparent" />
      </section>

      {/* ── Features grid ─────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto mb-24 max-w-5xl px-8">
        <div className="mb-12 text-center">
          <h2 className="text-[34px] font-black tracking-tight">
            Built for creators who care about privacy.
          </h2>
          <p className="mt-3 text-[15px] text-white/40">
            Every technical decision was made to protect your identity and content.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title}
              className="rounded-2xl border border-white/6 bg-white/[0.025] p-6 backdrop-blur-sm transition-all hover:border-rose-500/20 hover:bg-white/[0.04]">
              <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/8">
                <Icon size={18} className="text-rose-400" />
              </div>
              <h3 className="mb-2 text-[15px] font-bold text-white">{title}</h3>
              <p className="text-[13px] leading-relaxed text-white/40">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto mb-24 max-w-4xl px-8">
        <div className="mb-10 text-center">
          <h2 className="text-[34px] font-black tracking-tight">Three steps to a private editorial.</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[
            { n: "01", title: "Upload your photo", body: "Drop in a face reference (and an optional outfit photo). Your images never leave the vault." },
            { n: "02", title: "Choose a look",     body: "Pick from 8 cinema-grade editorial styles. Each prompt is tuned for identity preservation." },
            { n: "03", title: "Generate",           body: "Hit Generate. Face ID locks your likeness while the AI renders an 8K editorial in ~60 seconds." },
          ].map(({ n, title, body }) => (
            <div key={n} className="relative rounded-2xl border border-white/6 bg-white/[0.02] p-6">
              <div className="mb-3 text-[42px] font-black leading-none text-white/8">{n}</div>
              <h3 className="mb-2 text-[15px] font-bold text-white">{title}</h3>
              <p className="text-[13px] leading-relaxed text-white/40">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto mb-24 max-w-3xl px-8 text-center">
        <div className="rounded-3xl border border-rose-500/15 bg-rose-500/5 p-12 backdrop-blur-sm">
          <h2 className="mb-4 text-[40px] font-black tracking-tight leading-tight">
            Ready to shoot?
          </h2>
          <p className="mb-8 text-[15px] text-white/45">
            Operator-only. Private. Secured.
          </p>
          <button onClick={onEnter}
            className="group inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 px-8 py-4 text-[16px] font-black text-white shadow-[0_0_50px_rgba(225,29,106,0.35)] transition-all hover:shadow-[0_0_70px_rgba(225,29,106,0.55)] hover:scale-[1.02]">
            Enter the studio
            <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 px-8 py-6 text-center">
        <p className="text-[12px] text-white/20">
          🔞 18+ operator-only platform · Content is private and watermarked · Powered by Aurora AI
        </p>
      </footer>
    </div>
  );
}
