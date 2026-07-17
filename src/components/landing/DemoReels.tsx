import { Link } from "@tanstack/react-router";
import { Film, Mic2, ArrowRight } from "lucide-react";
import { AutoplayVideo } from "@/components/landing/AutoplayVideo";
// Hosted demo reels — URLs come from public/videos/*.asset.json
const lipsyncDemoUrl = "/__l5e/assets-v1/7ed0c81b-e8c4-4b2d-bd9f-6c7d5d47a8a9/lipsync-demo.mp4";

export function DemoReels() {
  return (
    <section className="relative z-10 px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="aurora-kicker mb-2 inline-flex items-center gap-2 justify-center">
            <Film className="size-3.5" /> Real renders · not stock
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground">
            Image → <span className="aurora-gradient-text">video</span> → <span className="bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">lip sync</span>.
          </h2>
          <p className="text-muted-foreground mt-3 text-sm md:text-base">
            Two of Aurora's most-used pipelines, end-to-end.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <Link
            to="/motion"
            className="group relative rounded-2xl overflow-hidden border border-border bg-black/40 no-underline hover:border-primary/60 transition"
          >
            <div className="relative aspect-video bg-black">
              <AutoplayVideo
                src={lipsyncDemoUrl}
                loop
                playsInline
                className="absolute inset-0 size-full object-cover"
              />
              <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/90 text-[10px] font-bold text-primary-foreground">
                <Film className="size-3" /> VIDEO GENERATION
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/70 to-transparent">
                <h3 className="text-lg font-bold text-white">Perform Anywhere · motion clip</h3>
                <p className="text-xs text-white/70 mt-0.5">Generate your AI scene → record on phone → transfer motion. Full Colors workflow.</p>
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                  Open Perform Anywhere <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </Link>

          <Link
            to="/lipsync"
            className="group relative rounded-2xl overflow-hidden border border-border bg-black/40 no-underline hover:border-emerald-400/60 transition"
          >
            <div className="relative aspect-video bg-black">
              <AutoplayVideo
                src={lipsyncDemoUrl}
                loop
                playsInline
                className="absolute inset-0 size-full object-cover"
              />
              <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/90 text-[10px] font-bold text-white">
                <Mic2 className="size-3" /> AVATAR · LIP SYNC
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/70 to-transparent">
                <h3 className="text-lg font-bold text-white">Avatar Studio · lip sync</h3>
                <p className="text-xs text-white/70 mt-0.5">Drop a vocal. Sync 1.9 + Wav2Lip · 3 Aura per render.</p>
                <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-white">
                  Open Lip Sync <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
