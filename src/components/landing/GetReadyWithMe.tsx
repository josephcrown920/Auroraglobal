import { Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Shirt, Sparkles } from "lucide-react";

const STAGES = [
  { label: "Mirror cold-open", color: "from-fuchsia-500 to-violet-600" },
  { label: "Outfit flat-lay", color: "from-cyan-500 to-blue-600" },
  { label: "Pick the look", color: "from-amber-400 to-orange-500" },
  { label: "Style & accessories", color: "from-emerald-400 to-teal-600" },
  { label: "Vanity moment", color: "from-violet-400 to-fuchsia-600" },
  { label: "Full-look reveal", color: "from-violet-400 to-indigo-600" },
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
                <p className="text-sm font-semibold text-white">Selfie + outfit reference</p>
              </div>
            </div>
          </div>

          {/* Right — copy + stage cards */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="aurora-kicker mb-3 inline-flex items-center gap-2">
                <Sparkles className="size-3.5" /> Virtual wardrobe · Identity-locked
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight">
                Get Ready With Me —<br />
                <span className="aurora-gradient-text">save your looks, try them on.</span>
              </h2>
              <p className="mt-4 text-white/65 text-base leading-relaxed">
                Upload your selfie, then pick an outfit from your saved wardrobe. Aurora locks your identity and threads the chosen look through every scene — mirror check, outfit reveal, full-look close-up. No studio. No crew. One photo in, a full getting-ready session out.
              </p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-fuchsia-400/25 bg-fuchsia-400/8 text-xs text-fuchsia-200/80">
                <Shirt className="size-3.5" /> Save any outfit once — reuse it across every shoot
              </div>
            </div>

            {/* Stage grid */}
            <div className="grid grid-cols-3 gap-2">
              {STAGES.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex flex-col gap-2"
                >
                  <div className={`size-7 rounded-full bg-gradient-to-br ${s.color} opacity-80`} />
                  <p className="text-xs font-semibold text-white/80">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/studio"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white no-underline bg-[image:var(--gradient-hero)] hover:brightness-110 shadow-[var(--shadow-glow-soft)]"
              >
                Try it in Studio <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/tiktok"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white/70 no-underline border border-white/10 hover:border-white/30 hover:text-white transition"
              >
                GRWM TikTok cuts
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
