import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { track } from "@/lib/tracking";

export function FinalCTA() {
  return (
    <section className="relative z-10 px-6 md:px-12 py-24">
      <div className="relative overflow-hidden rounded-3xl border border-border p-10 md:p-20 text-center bg-[#0a0815]">
        {/* glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 size-[680px] rounded-full blur-3xl opacity-60"
          style={{ background: "radial-gradient(circle, hsl(280 90% 60% / 0.55), transparent 60%)" }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs mb-6">
            <Sparkles className="size-3.5" /> 5 free Aura on signup
          </div>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
            Drop your song.
            <span className="block aurora-gradient-text">
              Get your video.
            </span>
          </h2>
          <p className="text-white/70 mt-5 max-w-xl mx-auto">
            Join 12,000+ artists using Aurora to turn tracks into scroll-stopping music videos — lip-synced, beat-matched and ready for TikTok. No studio, no crew, no CapCut.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/studio"
              onClick={() => void track("final_cta_click", { variant: "primary" })}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-medium text-white no-underline bg-[image:var(--gradient-hero)] hover:brightness-110 shadow-[var(--shadow-glow-soft)]"
            >
              <Sparkles className="size-4" /> Generate my music video free
            </Link>
            <Link
              to="/contact"
              onClick={() => void track("final_cta_click", { variant: "contact" })}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-medium text-foreground aurora-glass-strong hover:brightness-110 no-underline"
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
