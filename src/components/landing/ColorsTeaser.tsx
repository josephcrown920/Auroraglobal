import { Link } from "@tanstack/react-router";
import { ArrowRight, Palette } from "lucide-react";
import a1 from "@/assets/josh/josh-magenta-cyc-v2.jpg.asset.json";
import pinkA from "@/assets/josh/josh-pink-sideprofile.png.asset.json";
import pinkB from "@/assets/josh/josh-pink-jersey.png.asset.json";
import a2 from "@/assets/josh/josh-rainbow-stripes.png.asset.json";
import a3 from "@/assets/josh/josh-red-spotlights.jpg.asset.json";
import a4 from "@/assets/josh/josh-blue-orange.jpg.asset.json";
import a5 from "@/assets/josh/josh-yellow-mic.jpg.asset.json";
import a6 from "@/assets/josh/josh-neon-seated.png.asset.json";

const SHOTS = [
  { src: a1.url, label: "Magenta cyclorama · session 1" },
  { src: pinkA.url, label: "Hot-pink performance · side profile" },
  { src: pinkB.url, label: "Hot-pink performance · jersey portrait" },
  { src: a2.url, label: "Rainbow stripes set" },
  { src: a3.url, label: "Red spotlight cyclorama" },
  { src: a4.url, label: "Royal blue · orange puffer" },
  { src: a5.url, label: "Yellow cyclorama · vintage mic" },
  { src: a6.url, label: "Neon-line studio · seated" },
];

export function ColorsTeaser() {
  return (
    <section id="colors" className="relative px-6 md:px-12 py-20 md:py-28">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between gap-6 mb-8">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full aurora-glass text-xs text-white/70">
              <Palette className="size-3.5" /> Colors Studio
            </div>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-white">
              One selfie. <span className="aurora-gradient-text">Every color.</span>
            </h2>
            <p className="text-white/65 text-sm md:text-base">
              Pick a color and a scene — studio cyclorama, neon line-room, rooftop, street. Aurora preserves your face and outfit and rebuilds the whole set around it.
            </p>
          </div>
          <Link
            to="/colors"
            className="hidden md:inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-medium text-white bg-[image:var(--gradient-hero)] hover:brightness-110 shadow-[var(--shadow-glow-soft)] no-underline"
          >
            Open Colors Studio <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SHOTS.map((s, i) => (
            <figure
              key={s.src}
              className={`group relative overflow-hidden rounded-2xl aurora-glass ${
                i === 0 || i === 5 ? "md:row-span-2 aspect-[3/4] md:aspect-[3/5]" : "aspect-[3/4]"
              }`}
            >
              <img
                src={s.src}
                alt={s.label}
                loading="lazy"
                className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/30 to-transparent">
                <figcaption className="text-[11px] text-white/85">{s.label}</figcaption>
              </div>
            </figure>
          ))}
        </div>

        <div className="mt-6 md:hidden">
          <Link
            to="/colors"
            className="inline-flex w-full items-center justify-center gap-1.5 px-5 py-3 rounded-full text-sm font-medium text-white bg-[image:var(--gradient-hero)] no-underline"
          >
            Open Colors Studio <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
