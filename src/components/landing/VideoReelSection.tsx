import { Suspense, lazy } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Sparkles, Play, Wand2 } from "lucide-react";

import reelClip from "@/assets/josh/generated/clip-15-alley-neon.mp4";
import reelPoster from "@/assets/josh/generated/still-15-alley-neon.jpg";

export function VideoReelSection() {
  const { user } = useAuth();
  const ctaTo = user ? "/studio" : "/auth";

  return (
    <section className="py-20 px-5">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#8b5cf6]">
            Motion generation
          </span>
          <h2 className="mt-3 text-3xl font-semibold leading-tight">
            From still to <span className="bg-gradient-to-r from-violet-200 via-violet-400 to-fuchsia-300 bg-clip-text font-sans font-semibold text-transparent">cinema</span>.
          </h2>
        </div>
        <Link
          to="/music-video"
          className="inline-flex items-center gap-1 text-sm font-medium text-zinc-400 hover:text-zinc-100 shrink-0 transition-colors"
        >
          See more <ArrowUpRight className="size-4" />
        </Link>
      </div>
      <div className="relative overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/5">
        <img
          src={reelPoster}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden
        />
        <video
          src={reelClip}
          poster={reelPoster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="aspect-[4/5] w-full object-cover relative"
          aria-label="Aurora-generated cinematic music video — artist in a neon rain-soaked alley"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/80">
            Reel 001 · Motion v1
          </span>
          <Link
            to={ctaTo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/25 text-white no-underline hover:bg-white/20"
          >
            <Sparkles className="size-3" /> Create yours
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/studio"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full text-white no-underline bg-[image:var(--gradient-hero)] shadow-[var(--shadow-glow-soft)] hover:shadow-[var(--shadow-glow)] transition-shadow"
          >
            <Sparkles className="size-4" /> Explore the studio
          </Link>
          <Link
            to="/templates"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full no-underline aurora-glass-strong text-foreground hover:brightness-110"
          >
            <Wand2 className="size-4" /> Try a template
          </Link>
        </div>
      </div>
    </section>
  );
}
