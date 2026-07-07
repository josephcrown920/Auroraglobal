import { Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Sparkles } from "lucide-react";

const ANGLES = [
  { label: "Fish-eye", color: "from-fuchsia-500 to-violet-600" },
  { label: "Bird's-eye", color: "from-cyan-500 to-blue-600" },
  { label: "Low angle", color: "from-amber-400 to-orange-500" },
  { label: "Dutch tilt", color: "from-emerald-400 to-teal-600" },
  { label: "Macro", color: "from-rose-400 to-pink-600" },
  { label: "Worm's-eye", color: "from-violet-400 to-indigo-600" },
];

export function GetReadyWithMe() {
  return (
    <section className="relative z-10 px-6 md:px-12 py-20">
      {/* background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[700px] h-[400px] rounded-full bg-fuchsia-500/6 blur-[140px]" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[1fr_1.15fr] gap-10 items-center">
          {/* Left — mirror input photo */}
          <div className="relative">
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-fuchsia-500/30 to-violet-500/10 blur-sm" />
            <div className="relative rounded-3xl overflow-hidden border border-white/10 aspect-[3/4]">
              <img
                src="/josh/josh-mirror-getready.webp"
                alt="Get Ready With Me — mirror selfie input"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur border border-white/10 text-xs font-semibold text-white/90">
                <Camera className="size-3.5 text-fuchsia-300" /> Your mirror selfie
              </div>
              <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-xs text-white/55 uppercase tracking-widest mb-1">Input</p>
                <p className="text-sm font-semibold text-white">One real photo</p>
              </div>
            </div>
          </div>

          {/* Right — copy + angle cards */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="aurora-kicker mb-3 inline-flex items-center gap-2">
                <Sparkles className="size-3.5" /> Multi-angle · Identity-locked
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
                Get Ready With Me —<br />
                <span className="aurora-gradient-text">six angles from one photo.</span>
              </h2>
              <p className="mt-4 text-white/65 text-base leading-relaxed">
                Upload your mirror selfie. Aurora locks your identity — face, outfit, scene, lighting — and fans it out into six completely different camera angles. No studio. No crew. One photo in, a full editorial session out.
              </p>
            </div>

            {/* Angle grid */}
            <div className="grid grid-cols-3 gap-2">
              {ANGLES.map((a) => (
                <div
                  key={a.label}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex flex-col gap-2"
                >
                  <div className={`size-7 rounded-full bg-gradient-to-br ${a.color} opacity-80`} />
                  <p className="text-xs font-semibold text-white/80">{a.label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/reshoot"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white no-underline bg-[image:var(--gradient-hero)] hover:brightness-110 shadow-[var(--shadow-glow-soft)]"
              >
                Try Reshoot Studio <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/canvas"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white/70 no-underline border border-white/10 hover:border-white/30 hover:text-white transition"
              >
                View in Canvas
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
