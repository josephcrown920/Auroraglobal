import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Phone, Palette, Film, Zap, Crown, Upload } from "lucide-react";

const MODELS = ["Seedance 5.9", "Kling", "Gemini Omni", "Grok Imagine"];

const STEPS = [
  {
    n: "01",
    icon: Palette,
    label: "Turn a selfie into a cinematic performance",
    desc: "Open Colors Studio. Upload a selfie — Aurora places you in a pro cyclorama set. Pick your color, your vibe, your energy. Full cinematic 9:16 portrait, your face, your outfit.",
    accent: "from-violet-500/30 to-fuchsia-500/10",
    border: "border-violet-500/30",
    badge: "Colors Studio",
    badgeColor: "bg-violet-500/20 text-violet-300",
    to: "/colors",
  },
  {
    n: "02",
    icon: Phone,
    label: "Record on your phone",
    desc: "Film yourself performing your song. 30 seconds, any angle, anywhere — your couch, your car, your mirror. Phone camera is all you need.",
    accent: "from-cyan-500/30 to-blue-500/10",
    border: "border-cyan-500/30",
    badge: "Your phone",
    badgeColor: "bg-cyan-500/20 text-cyan-300",
    to: null,
  },
  {
    n: "03",
    icon: Film,
    label: "Aurora transfers your motion",
    desc: "Drop your AI image + phone clip into Perform Anywhere. Aurora's Motion Control reads your real movement — gestures, body, energy — and transfers it into the generated scene.",
    accent: "from-primary/30 to-violet-500/10",
    border: "border-primary/30",
    badge: "Motion Control · Style Transfer",
    badgeColor: "bg-primary/20 text-primary",
    to: "/motion",
  },
];

export function PerformAnywhereSection() {
  return (
    <section className="relative z-10 px-4 md:px-8 py-8 md:py-12">
      {/* Premium bordered container */}
      <div className="relative max-w-6xl mx-auto rounded-[28px] overflow-hidden border border-primary/40 bg-gradient-to-br from-violet-950/60 via-[#0d0820]/80 to-fuchsia-950/30 shadow-[0_0_100px_-30px_oklch(0.72_0.2_300),inset_0_1px_0_rgba(168,85,247,0.2)]">
        {/* ambient glow */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[300px] rounded-full bg-fuchsia-600/8 blur-[100px]" />
        </div>

        {/* top accent line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        <div className="relative px-6 py-10 md:px-12 md:py-14">

          {/* Premium badge */}
          <div className="flex justify-center mb-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-gradient-to-r from-amber-500/15 via-yellow-400/10 to-orange-500/10 px-4 py-1.5 backdrop-blur-sm shadow-[0_0_20px_-8px_rgba(251,191,36,0.5)]">
              <Crown className="size-3.5 text-amber-400" />
              <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-amber-300">
                Premium Feature
              </span>
            </div>
          </div>

          {/* header */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <p className="aurora-kicker mb-3 inline-flex items-center gap-2 justify-center">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              Perform Anywhere · Motion Control
            </p>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05]">
              Film yourself anywhere.{" "}
              <span className="aurora-gradient-text">Aurora builds the world.</span>
            </h2>
            <p className="text-muted-foreground mt-4 text-base max-w-2xl mx-auto leading-relaxed">
              Aurora's <strong className="text-white">Motion Control</strong> reads your real movement from a 30-second phone clip and transfers it into your AI-generated scene — style, motion, energy. No studio, no crew, no budget.
            </p>

            {/* Model power strip */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 mr-1">Powered by</span>
              {MODELS.map((m) => (
                <span key={m} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-[0_0_12px_-4px_oklch(0.72_0.2_300)]">
                  <span className="size-1 rounded-full bg-primary animate-pulse" />
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Before → After visual */}
          <div className="mb-10 grid grid-cols-[1fr_auto_1fr] gap-4 items-center max-w-3xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden aspect-[3/4] border border-white/10">
              <img
                src="/josh/generated2/perform-phone-clip.webp"
                alt="Input — phone clip recorded at home"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/80">
                <Phone className="size-3 text-cyan-300" /> Your phone clip
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-xs text-white/50">Real movement · any room</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 px-2">
              <div className="size-10 rounded-full bg-primary/20 border border-primary/30 grid place-items-center shadow-[0_0_20px_-4px_var(--color-primary)]">
                <Zap className="size-5 text-primary" />
              </div>
              <p className="text-[10px] uppercase tracking-widest text-white/30 text-center">Motion<br />Control</p>
            </div>

            <Link to="/motion" className="no-underline block relative rounded-2xl overflow-hidden aspect-[3/4] border border-primary/60 shadow-[0_0_60px_-10px_var(--color-primary)] group cursor-pointer">
              <div className="w-full h-full bg-gradient-to-br from-violet-900/80 via-fuchsia-900/60 to-black flex items-center justify-center">
                <div className="text-center px-4">
                  <div className="size-14 rounded-full bg-primary/20 border border-primary/40 grid place-items-center mx-auto mb-3 group-hover:scale-110 transition-transform shadow-[0_0_30px_-6px_oklch(0.72_0.2_300)]">
                    <Upload className="size-6 text-primary" />
                  </div>
                  <p className="text-sm font-bold text-white">Upload your clip here.</p>
                  <p className="text-xs text-white/50 mt-1">30 sec · any phone · any room</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/20 border border-primary/30 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                    <Sparkles className="size-3" /> Perform Anywhere →
                  </div>
                </div>
              </div>
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/20 backdrop-blur border border-primary/30 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Film className="size-3" /> AI scene output
              </div>
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-xs text-white/50">Cinematic result · your identity locked</p>
              </div>
            </Link>
          </div>

          {/* 3-step cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-10">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const card = (
                <div className={`group relative aurora-card overflow-hidden ${s.to ? "aurora-card-hover cursor-pointer" : ""}`}>
                  <div className={`absolute -inset-10 blur-3xl opacity-30 bg-gradient-to-br ${s.accent} group-hover:opacity-50 transition-opacity pointer-events-none`} />
                  <div className="relative p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${s.border} ${s.badgeColor}`}>
                        <Icon className="size-3" />
                        {s.badge}
                      </span>
                      <span className="text-4xl font-bold text-muted-foreground/20 leading-none">{s.n}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground mb-1.5">{s.label}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                    </div>
                    {s.to && (
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                        Open <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    )}
                  </div>
                </div>
              );

              return s.to ? (
                <Link key={i} to={s.to as "/colors" | "/motion"} className="no-underline">
                  {card}
                </Link>
              ) : (
                <div key={i}>{card}</div>
              );
            })}
          </div>

          {/* bottom CTA strip */}
          <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-black/40 to-fuchsia-900/20 backdrop-blur px-6 md:px-10 py-7 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_60px_-20px_oklch(0.72_0.2_300)]">
            <div>
              <div className="inline-flex items-center gap-1.5 mb-2">
                <Crown className="size-3.5 text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400/80">State-of-the-Art AI · Seedance 5.9 · Kling · Gemini Omni · Grok Imagine</span>
              </div>
              <p className="font-bold text-lg text-white">Upload your performance video — Aurora builds the world.</p>
              <p className="text-sm text-white/50 mt-1">
                <Upload className="size-3.5 inline mr-1.5 text-primary" />
                Film yourself performing (30 sec, any phone) → drop it into Perform Anywhere → cinematic scene, your identity locked.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/colors"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-5 py-2.5 text-sm font-semibold text-foreground no-underline hover:border-primary/40 transition-colors"
              >
                <Palette className="size-4 text-violet-400" /> Build Your Scene
              </Link>
              <Link
                to="/motion"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-primary-foreground no-underline hover:opacity-90 transition-opacity shadow-[0_0_24px_-6px_var(--color-primary)] animate-pulse"
                style={{ background: "var(--gradient-hero)" }}
              >
                <Upload className="size-4" /> Upload Your Clip →
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
