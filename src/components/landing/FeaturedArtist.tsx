import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

// The kling-artist.jpeg is a composite of 4 editorial shots.
// We use object-position to crop each quadrant into its own tile.
const QUADRANTS: { label: string; objectPosition: string }[] = [
  { label: "Editorial 1", objectPosition: "top left" },
  { label: "Editorial 2", objectPosition: "top right" },
  { label: "Editorial 3", objectPosition: "bottom left" },
  { label: "Editorial 4", objectPosition: "bottom right" },
];

export function FeaturedArtist() {
  return (
    <section className="relative z-10 px-5 py-16 border-t border-white/5">
      {/* Subtle violet glow */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse_at_top,oklch(0.45_0.18_295/0.18)_0%,transparent_70%)]" />

      <div className="relative rounded-3xl border border-white/8 bg-zinc-900/60 overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          {/* 2×2 image grid */}
          <div className="grid grid-cols-2 grid-rows-2 aspect-square">
            {QUADRANTS.map((q) => (
              <div key={q.label} className="overflow-hidden">
                <img
                  src="/spotlight/kling-artist.jpeg"
                  alt={q.label}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  style={{
                    objectPosition: q.objectPosition,
                    transform: "scale(2)",
                    transformOrigin: q.objectPosition,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Text content */}
          <div className="flex flex-col justify-center p-8 md:p-12">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6] mb-4">
              Featured Artist
            </span>
            <h2 className="text-4xl md:text-5xl font-semibold leading-tight text-white mb-2">
              Kling
            </h2>
            <p className="text-sm font-medium text-zinc-400 mb-1">
              Powered by Aurora
            </p>
            <p className="mt-4 text-base leading-relaxed text-zinc-300 max-w-[36ch]">
              Atlanta-based artist and one of Aurora&apos;s earliest creators — using Seedance 2.0 and Kling 3.0 to build his visual world.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <Link
                to="/gallery"
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#8b5cf6] px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_24px_-4px_rgba(139,92,246,0.55)] transition-transform hover:scale-[1.02] active:scale-95 no-underline"
              >
                See his work <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
