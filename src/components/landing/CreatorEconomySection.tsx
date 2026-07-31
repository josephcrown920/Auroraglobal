import { Link } from "@tanstack/react-router";
import { Lock, ShieldCheck, EyeOff, ArrowRight, Star } from "lucide-react";
import { track } from "@/lib/tracking";
import { useSiteImage } from "@/components/landing/SiteImagesProvider";

const TRUST_POINTS = [
  { icon: EyeOff,      label: "Identity masking",   desc: "AI face-swap and blur on demand — stay as anonymous as you choose." },
  { icon: Lock,        label: "Private vault",       desc: "Every output stored in your private folder. No public indexing, ever." },
  { icon: ShieldCheck, label: "Watermark built-in",  desc: "Brand every frame automatically. Makes DMCA takedowns trivially easy." },
  { icon: Star,        label: "Subscriber magnets",  desc: "Magazine-grade editorial looks keep your audience paying and coming back." },
];

export function CreatorEconomySection() {
  const c1 = useSiteImage("creator_1");
  const c2 = useSiteImage("creator_2");
  const c3 = useSiteImage("creator_3");
  const c4 = useSiteImage("creator_4");
  const c5 = useSiteImage("creator_5");
  const c6 = useSiteImage("creator_6");
  const LOOKS = [
    { src: c1, label: "Boudoir Editorial" },
    { src: c2, label: "Velvet Fantasy" },
    { src: c3, label: "Golden Seduction" },
    { src: c4, label: "Neon Temptation" },
    { src: c5, label: "Luxury Suite" },
    { src: c6, label: "Private Collection" },
  ];
  return (
    <section className="relative px-6 md:px-12 py-20 overflow-hidden">
      {/* Background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 size-[600px] rounded-full blur-[120px] opacity-30"
        style={{ background: "radial-gradient(circle, oklch(0.55 0.22 340), transparent 65%)" }}
      />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400 text-[11px] font-semibold tracking-wide mb-5">
            <Lock className="size-3" /> 18+ Creators · OnlyFans · Adult Content
          </div>

          <div className="grid gap-10 items-start" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            <div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-[1.05] text-white">
                Your content.{" "}
                <span className="text-rose-400">Your control.</span>
              </h2>
              <p className="mt-4 text-white/60 text-base md:text-lg leading-relaxed">
                AI photoshoots that protect your identity, amplify your brand,
                and keep subscribers wanting more. No set. No photographer.
                Complete discretion.
              </p>

              {/* Feature list */}
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {TRUST_POINTS.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="flex gap-3">
                    <div className="mt-0.5 flex-shrink-0 size-8 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                      <Icon className="size-4 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="text-xs text-white/45 mt-0.5 leading-snug">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/studio"
                  onClick={() => void track("creator_economy_cta")}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-bold text-white no-underline bg-rose-600 hover:bg-rose-500 shadow-[0_0_24px_oklch(0.55_0.22_15/0.4)] transition-all hover:scale-[1.02]"
                >
                  Start my shoot <ArrowRight className="size-4" />
                </Link>
                <p className="self-center text-[11px] text-white/30">
                  Private by default · Your content stays yours
                </p>
              </div>
            </div>

            {/* Photo grid */}
            <div className="grid grid-cols-3 gap-2">
              {LOOKS.map((look) => (
                <div
                  key={look.src}
                  className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 bg-white/5 group"
                >
                  <img
                    src={look.src}
                    alt={look.label}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <span className="absolute bottom-2 left-2 right-2 text-[8px] font-semibold uppercase tracking-widest text-white/65 leading-tight">
                    {look.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom stats bar */}
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 pt-8 border-t border-white/8 text-[11px] text-white/35 font-medium">
          <span>🔒 Zero public indexing</span>
          <span>🛡 Watermark every frame</span>
          <span>👁 Identity masking on demand</span>
          <span>📂 Private cloud vault</span>
          <span>⚡ Results in under 60 seconds</span>
        </div>
      </div>
    </section>
  );
}
