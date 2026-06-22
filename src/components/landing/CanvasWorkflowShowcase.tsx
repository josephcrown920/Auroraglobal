import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Workflow, Megaphone, Check } from "lucide-react";
import { FINISHED_WORKFLOWS } from "@/components/canvas/FinishedWorkflowsGallery";
import avatar1 from "@/assets/ugc-avatar-1.jpg";
import avatar2 from "@/assets/ugc-avatar-2.jpg";
import avatar3 from "@/assets/ugc-avatar-3.jpg";
import avatar4 from "@/assets/ugc-avatar-4.jpg";
import avatar5 from "@/assets/ugc-avatar-5.jpg";
import avatar6 from "@/assets/ugc-avatar-6.jpg";
import realStreet from "@/assets/ugc/ugc-street-coffee.jpeg.asset.json";
import realMale from "@/assets/ugc/ugc-male-shades.jpeg.asset.json";
import realHome from "@/assets/ugc/ugc-home-selfie.webp.asset.json";
import realCar from "@/assets/ugc/ugc-car-product-hold.webp.asset.json";

const UGC_AVATARS = [
  { name: "Sasha", vibe: "Street style · coffee run", img: (realStreet as { url: string }).url },
  { name: "Marcus", vibe: "Eyewear · product hero", img: (realMale as { url: string }).url },
  { name: "Priya", vibe: "At-home vlog selfie", img: (realHome as { url: string }).url },
  { name: "Emma", vibe: "Car-seat product hold", img: (realCar as { url: string }).url },
  { name: "Maya", vibe: "Cozy reviewer", img: avatar1 },
  { name: "Deon", vibe: "Tech talk", img: avatar2 },
  { name: "Luna", vibe: "Golden hour", img: avatar3 },
  { name: "Kenji", vibe: "Gym & wellness", img: avatar4 },
  { name: "Ava", vibe: "Cafe blogger", img: avatar5 },
  { name: "Rio", vibe: "Morning routine", img: avatar6 },
];

export function CanvasWorkflowShowcase() {
  // Feature one finished workflow next to a grid of more
  const [hero, ...rest] = FINISHED_WORKFLOWS;
  const more = rest.slice(0, 4);

  return (
    <>
      {/* CANVAS + WORKFLOWS */}
      <section className="relative z-10 px-6 md:px-12 py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300/80 mb-2 inline-flex items-center gap-2 justify-center">
            <Workflow className="size-3.5" /> Canvas · finished workflows
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Wire it once. Ship it forever.
          </h2>
          <p className="text-white/65 mt-4">
            Aurora Canvas is a node graph for creators — selfie, outfit, audio, prompt. Every card below is a real pipeline we've already rendered. Clone it into your canvas and run.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-5 max-w-6xl mx-auto">
          {/* Hero workflow */}
          <Link
            to="/canvas"
            className="group relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 no-underline hover:border-emerald-400/50 transition"
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={hero.cover}
                alt={hero.name}
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
              />
              <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-400/90 text-[10px] font-bold text-emerald-950">
                <CheckCircle2 className="size-3" /> DONE · CANVAS PIPELINE
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black via-black/70 to-transparent">
                <p className="text-[10px] uppercase tracking-widest text-emerald-300">{hero.category}</p>
                <h3 className="mt-1 text-2xl font-bold text-white">{hero.name}</h3>
                <p className="text-sm text-white/70 mt-1 max-w-md">{hero.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {hero.models.map((m) => (
                    <span key={m} className="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] text-white/80">
                      {m}
                    </span>
                  ))}
                </div>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                  Open in Canvas <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </Link>

          {/* More finished workflows */}
          <div className="grid grid-cols-2 gap-3">
            {more.map((wf) => (
              <Link
                key={wf.id}
                to="/canvas"
                className="group relative rounded-xl overflow-hidden border border-white/10 bg-black/40 no-underline hover:border-emerald-400/50 transition"
              >
                <div className="relative aspect-[4/5]">
                  <img src={wf.cover} alt={wf.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-400/90 text-[9px] font-bold text-emerald-950">
                    <CheckCircle2 className="size-2.5" /> DONE
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/95 via-black/55 to-transparent">
                    <p className="text-[9px] uppercase tracking-widest text-emerald-300/90">{wf.category}</p>
                    <p className="text-sm font-semibold text-white leading-tight">{wf.name}</p>
                    <p className="text-[10px] text-white/55 mt-0.5">{wf.nodes} nodes · {wf.credits} credits</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            to="/canvas"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-white no-underline bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-95 shadow-lg shadow-violet-500/30"
          >
            Open Canvas <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* UGC FACTORY */}
      <section className="relative z-10 px-6 md:px-12 py-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-300/80 mb-2 inline-flex items-center gap-2 justify-center">
            <Megaphone className="size-3.5" /> UGC Factory
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Pick an avatar. Ship a TikTok ad.
          </h2>
          <p className="text-white/65 mt-4">
            Six on-brand AI creators, ready to film. Pick a face, pick a scene, drop your product — Aurora ships a native, scroll-stopping UGC ad in seconds.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 max-w-6xl mx-auto">
          {UGC_AVATARS.map((a, i) => (
            <Link
              key={a.name}
              to="/ugc"
              className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-rose-400/60 no-underline transition animate-fade-in"
              style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
            >
              <div className="relative aspect-square">
                <img src={a.img} alt={a.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                  <p className="text-white text-sm font-semibold leading-none">{a.name}</p>
                  <p className="text-white/70 text-[10px] mt-0.5 leading-tight">{a.vibe}</p>
                </div>
                <span className="absolute top-2 right-2 size-6 rounded-full bg-rose-500/90 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition">
                  <Check className="size-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            to="/ugc"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-medium text-white no-underline bg-gradient-to-r from-rose-500 to-pink-500 hover:opacity-95 shadow-lg shadow-rose-500/30"
          >
            Open UGC Factory <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
