import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

const MODELS = [
  {
    badge: "NOW AVAILABLE",
    title: "Seedance 2.0",
    sub: "Cinematic 5–10s clips · highest quality video",
    image: "/spotlight/apex-goggles.jpeg",
    to: "/studio" as const,
    glow: "from-teal-500/30 to-cyan-500/10",
    badgeColor: "bg-teal-500/20 text-teal-300 border-teal-400/40",
  },
  {
    badge: "NOW AVAILABLE",
    title: "Kling 3.0",
    sub: "Motion-first · UGC ads · real-world physics",
    image: "/spotlight/drift-moodboard.png",
    to: "/studio" as const,
    glow: "from-violet-500/30 to-fuchsia-500/10",
    badgeColor: "bg-violet-500/20 text-violet-300 border-violet-400/40",
  },
] as const;

export function ModelSpotlight() {
  return (
    <section className="relative z-10 px-5 py-16 border-t border-white/5 overflow-hidden">
      {/* Full-bleed cinematic stills texture behind the cards */}
      <img
        src="/spotlight/cinematic-stills.jpeg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.08] select-none"
      />

      <div className="relative">
        <div className="mb-8 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
            Frontier models
          </span>
          <h2 className="mt-2 text-3xl font-semibold leading-tight">
            Frontier models,{" "}
            <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">
              live now.
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {MODELS.map((model) => (
            <Link
              key={model.title}
              to={model.to}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-sm no-underline transition-all hover:-translate-y-0.5 hover:border-white/20"
            >
              {/* Glow accent */}
              <div
                className={`absolute -inset-12 opacity-0 group-hover:opacity-60 blur-3xl bg-gradient-to-br ${model.glow} transition-opacity pointer-events-none`}
              />

              {/* Hero image */}
              <div className="aspect-[16/9] overflow-hidden border-b border-white/8">
                <img
                  src={model.image}
                  alt={model.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>

              {/* Content */}
              <div className="relative p-5">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${model.badgeColor} mb-3`}
                >
                  {model.badge}
                </span>
                <h3 className="text-xl font-bold text-white">{model.title}</h3>
                <p className="mt-1 text-sm text-zinc-400">{model.sub}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#8b5cf6] group-hover:gap-2 transition-all">
                  Try it <ArrowRight className="size-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
