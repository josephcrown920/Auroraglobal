import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Phone, Palette, Film, Zap } from "lucide-react";

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
    <section className="relative z-10 px-6 md:px-12 py-16 md:py-24">
      {/* background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[600px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        {/* header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <p className="aurora-kicker mb-3 inline-flex items-center gap-2 justify-center">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Perform Anywhere · Motion Control
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Film yourself anywhere.{" "}
            <span className="aurora-gradient-text">Aurora builds the world.</span>
          </h2>
          <p className="text-muted-foreground mt-4 text-base max-w-2xl mx-auto leading-relaxed">
            Aurora's <strong className="text-white">Motion Control</strong> reads your real movement from a 30-second phone clip and transfers it into your AI-generated scene — style, motion, energy. No studio, no crew, no budget.
          </p>
        </div>

        {/* Before → After visual */}
        <div className="mb-10 grid grid-cols-[1fr_auto_1fr] gap-4 items-center max-w-3xl mx-auto">
          <div className="relative rounded-2xl overflow-hidden aspect-[3/4] border border-white/10">
            <img
              src="/josh/josh-mirror-getready.webp"
              alt="Input — mirror selfie phone recording"
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
            <div className="size-10 rounded-full bg-primary/20 border border-primary/30 grid place-items-center">
              <Zap className="size-5 text-primary" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-white/30 text-center rotate-0">Motion<br />Control</p>
          </div>

          <div className="relative rounded-2xl overflow-hidden aspect-[3/4] border border-primary/30 shadow-[0_0_40px_-10px_var(--color-primary)]">
            <div className="w-full h-full bg-gradient-to-br from-violet-900/80 via-fuchsia-900/60 to-black flex items-center justify-center">
              <div className="text-center px-4">
                <Sparkles className="size-8 text-primary mx-auto mb-3 opacity-70" />
                <p className="text-sm font-semibold text-white/80">Your moves.</p>
                <p className="text-sm font-semibold aurora-gradient-text">AI-generated world.</p>
              </div>
            </div>
            <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/20 backdrop-blur border border-primary/30 text-[10px] font-bold uppercase tracking-widest text-primary">
              <Film className="size-3" /> AI scene output
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
              <p className="text-xs text-white/50">Cinematic result · your identity locked</p>
            </div>
          </div>
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
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur px-6 md:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-5">
          <div>
            <p className="font-semibold text-base">Ready to make your first performance video?</p>
            <p className="text-sm text-muted-foreground mt-0.5">Start in Colors Studio — generate your AI scene in under 60 seconds.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/colors"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-5 py-2.5 text-sm font-semibold text-foreground no-underline hover:border-primary/40 transition-colors"
            >
              <Palette className="size-4 text-violet-400" /> Colors Studio
            </Link>
            <Link
              to="/motion"
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-primary-foreground no-underline hover:opacity-90 transition-opacity"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Sparkles className="size-4" /> Perform Anywhere
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
