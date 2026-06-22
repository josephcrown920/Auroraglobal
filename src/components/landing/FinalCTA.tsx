import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { track } from "@/lib/tracking";

export function FinalCTA() {
  return (
    <section className="relative z-10 px-6 md:px-12 py-24">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 p-10 md:p-20 text-center bg-[#0a0815]">
        {/* glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[680px] rounded-full blur-3xl opacity-60"
          style={{ background: "radial-gradient(circle, hsl(280 90% 60% / 0.55), transparent 60%)" }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-400/30 bg-violet-500/10 text-violet-200 text-xs mb-6">
            <Sparkles className="size-3.5" /> 5 free Aurora on signup
          </div>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Your next campaign
            <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-200 bg-clip-text text-transparent">
              starts with a selfie.
            </span>
          </h2>
          <p className="text-white/70 mt-5 max-w-xl mx-auto">
            Join 12,000+ creators using Aurora to ship music videos, ad creatives and editorial covers — without a studio, a crew or a stack of subscriptions.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/studio"
              onClick={() => void track("final_cta_click", { variant: "primary" })}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-medium text-white no-underline bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-95 shadow-xl shadow-violet-500/40"
            >
              <Sparkles className="size-4" /> Start creating free
            </Link>
            <Link
              to="/contact"
              onClick={() => void track("final_cta_click", { variant: "contact" })}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-medium text-white/90 border border-white/15 hover:bg-white/5 no-underline"
            >
              Talk to the team <ArrowRight className="size-4" />
            </Link>
          </div>
          <p className="text-xs text-white/40 mt-6">No card required · Commercial license · 7-day refund</p>
        </div>
      </div>
    </section>
  );
}
