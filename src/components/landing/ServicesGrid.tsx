import { Camera, Film, Wand2, Megaphone, Activity, Workflow, Image as ImageIcon, Palette, CreditCard, Flame } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { AutoplayVideo } from "@/components/landing/AutoplayVideo";
import demo1 from "@/assets/demo-1.mov.asset.json";
import demo2 from "@/assets/demo-2.mov.asset.json";

const SERVICES = [
  { icon: Wand2, title: "Music Video Lip Sync", desc: "Frame-accurate Sync 1.9 lip-sync. Drop your track — get a music video that looks like you really sang it.", to: "/lipsync" as const, accent: "from-emerald-500/30 to-teal-500/10", video: null as string | null },
  { icon: Megaphone, title: "UGC Ads Factory", desc: "Pick an AI creator, drop your product, ship iPhone-real UGC ads in seconds — scroll-stopping content, no camera needed.", to: "/ugc" as const, accent: "from-rose-500/30 to-pink-500/10", video: demo1.url },
  { icon: Flame, title: "Spin 1 → 30 Posts", desc: "Type one prompt. Aurora spins it into 30 high-variation posts — same face, endless looks, captions and styles all different.", to: "/spin" as const, accent: "from-orange-500/30 to-amber-500/10", video: null as string | null },
  { icon: Film, title: "Video Generation", desc: "Cinematic 5–10s performance clips. Seedance 2.0 and Kling 3.0 in one canvas.", to: "/studio" as const, accent: "from-indigo-500/30 to-violet-500/10", video: demo2.url },
  { icon: ImageIcon, title: "Image Generation", desc: "Cover art and press shots from a selfie. Seedream 4.5, Nano Banana Pro.", to: "/studio" as const, accent: "from-violet-500/30 to-fuchsia-500/10", video: null as string | null },
  { icon: Palette, title: "Cover Art Studio", desc: "Pick a color, pick a studio. Pro mic, pro lighting, single-cover-grade portraits.", to: "/colors" as const, accent: "from-amber-500/30 to-orange-500/10", video: null as string | null },
  { icon: Activity, title: "Motion Control", desc: "Drive your character with a reference move. Real dance, real choreography for your visuals.", to: "/motion" as const, accent: "from-cyan-500/30 to-blue-500/10", video: null as string | null },
  { icon: Workflow, title: "Canvas", desc: "Wire your song, selfie, outfit and prompt nodes. Save, share, re-run.", to: "/canvas" as const, accent: "from-fuchsia-500/30 to-purple-500/10", video: null as string | null },
];

export function ServicesGrid() {
  return (
    <section id="services" className="relative z-10 px-6 md:px-12 py-20">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <p className="aurora-kicker mb-2">Our services</p>
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">Eight tools. One studio.</h2>
        <p className="text-white/65 mt-4">
          Everything an artist needs to turn a song into a viral video — lip-sync, beat-sync remixes, cover art, performance clips and more. One studio, no shoot day.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SERVICES.map((s, i) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.title}
              to={s.to}
              className="group relative aurora-card aurora-card-hover overflow-hidden no-underline animate-fade-in"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
            >
              {s.video && (
                <div className="aspect-video bg-black/40 overflow-hidden border-b border-border">
                  <AutoplayVideo
                    src={s.video}
                    loop
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={(e) => {
                      // Source clips are screen recordings — bump playback so they feel natural.
                      (e.currentTarget as HTMLVideoElement).playbackRate = 1.6;
                    }}
                    style={{ imageRendering: "auto" }}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition [filter:contrast(1.05)_saturate(1.08)]"
                  />
                </div>
              )}
              <div className="relative p-5">
                <div className={`absolute -inset-20 blur-3xl opacity-40 bg-gradient-to-br ${s.accent} group-hover:opacity-70 transition-opacity pointer-events-none`} />
                <div className="relative">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/10 border border-border mb-4">
                    <Icon className="size-5 text-primary" />
                  </span>
                  <h3 className="text-base font-semibold text-white">{s.title}</h3>
                  <p className="text-sm text-white/60 mt-1.5 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-white/50">
        <span className="inline-flex items-center gap-1.5"><CreditCard className="size-3.5 text-primary" /> Aura-based · no per-model surcharge</span>
        <span className="hidden sm:inline text-white/20">·</span>
        <span className="inline-flex items-center gap-1.5"><Camera className="size-3.5 text-primary" /> Commercial license on every plan</span>
      </div>
    </section>
  );
}
