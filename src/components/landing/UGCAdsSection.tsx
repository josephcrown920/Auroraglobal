/**
 * UGCAdsSection — landing teaser for the /ugc UGC Ads tool.
 * Clean dark section with feature chips, preview image, and CTA.
 */
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Megaphone, Zap, Camera, TrendingUp } from "lucide-react";
import { track } from "@/lib/tracking";

const FEATURES = [
  { icon: Camera,     label: "Drop a product photo" },
  { icon: Zap,        label: "AI writes the hook" },
  { icon: Megaphone,  label: "Natural creator voice" },
  { icon: TrendingUp, label: "Ready to post" },
];

export function UGCAdsSection() {
  return (
    <section className="relative z-10 overflow-hidden border-t border-white/5 px-5 py-16">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-72 w-72 -translate-y-1/3 translate-x-1/3 rounded-full bg-amber-500/10 blur-[80px]"
      />

      <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
        {/* Left — copy */}
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/[0.07] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-amber-300">
            <Megaphone className="size-3.5" /> UGC Ads
          </span>

          <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-white">
            Turn any product into{" "}
            <span className="bg-gradient-to-r from-amber-200 via-orange-300 to-amber-400 bg-clip-text text-transparent">
              a viral ad.
            </span>
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-zinc-400 max-w-[40ch]">
            Drop a product photo or idea. Aurora writes a creator-style hook, casts
            a face, and renders a natural UGC ad — no actor, no crew, no studio.
          </p>

          {/* Feature chips */}
          <ul className="mt-6 grid grid-cols-2 gap-2.5">
            {FEATURES.map((f) => (
              <li
                key={f.label}
                className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
                  <f.icon className="size-3.5" />
                </span>
                <span className="text-xs font-medium text-zinc-300">{f.label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/ugc"
              onClick={() => void track("ugc_ads_cta")}
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-amber-950 no-underline shadow-[0_6px_24px_-4px_rgba(251,191,36,0.5)] transition hover:scale-[1.02] active:scale-95"
            >
              Make a UGC Ad <ArrowUpRight className="size-4" />
            </Link>
            <Link
              to="/ugc-line"
              onClick={() => void track("ugc_line_cta")}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white no-underline transition hover:bg-white/[0.08]"
            >
              Content Line
            </Link>
          </div>
        </div>

        {/* Right — preview image */}
        <div className="relative overflow-hidden rounded-3xl border border-white/8 bg-zinc-900 aspect-square md:aspect-[4/5]">
          <img
            src="/nav-previews/ugc.jpg"
            alt="UGC ad example"
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-amber-300 backdrop-blur-sm border border-amber-400/20">
              <Zap className="size-3" /> From 15 Aura
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
