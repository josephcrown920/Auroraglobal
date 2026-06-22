import { Zap, Layers, Globe2, Shield } from "lucide-react";

const PILLARS = [
  {
    icon: Layers,
    title: "Every frontier model, one canvas",
    desc: "Seedance 2.0, Kling 3.0, Seedream 4.5, Nano Banana Pro, Sync 1.9. Switch between them mid-project — no extra subscription.",
  },
  {
    icon: Zap,
    title: "Minutes, not weeks",
    desc: "Selfie → cinematic shot in 12 seconds. Audio + photo → lip-sync video in under a minute. Pipelines you can re-run on autopilot.",
  },
  {
    icon: Globe2,
    title: "Built for creators worldwide",
    desc: "Trusted by artists, agencies and brands across 40+ countries. Multilingual agent. Pay in local currency via Paystack.",
  },
  {
    icon: Shield,
    title: "You own everything",
    desc: "Full commercial license on every render. We never train on your content. Delete any upload, any time.",
  },
];

export function WhyUs() {
  return (
    <section className="relative z-10 px-6 md:px-12 py-20">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-600/15 via-fuchsia-600/5 to-transparent p-8 md:p-14">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <p className="text-xs uppercase tracking-[0.2em] text-violet-300/80 mb-2">Why Aurora</p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              The fastest path from
              <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-200 bg-clip-text text-transparent">
                idea to finished asset.
              </span>
            </h2>
            <p className="text-white/65 mt-5 max-w-md">
              Aurora isn't another image app. It's a creative operating system — every tool a modern creator needs, working together, on one balance.
            </p>
          </div>
          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            {PILLARS.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-5 hover:border-violet-400/40 transition animate-fade-in"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
                >
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/10 border border-white/10 mb-4">
                    <Icon className="size-5 text-violet-200" />
                  </span>
                  <h3 className="text-base font-semibold text-white">{p.title}</h3>
                  <p className="text-sm text-white/60 mt-1.5 leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
