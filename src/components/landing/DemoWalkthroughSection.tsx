import { Suspense, lazy } from "react";
import { ScrollReveal } from "@/components/visual/ScrollReveal";
import { DemoMedia } from "@/components/visual/DemoMedia";
import { DEMO_ASSETS } from "@/lib/demo-assets";

export function DemoWalkthroughSection() {
  return (
    <section className="border-b border-white/8 bg-[#08080e] px-5 py-12">
      <ScrollReveal className="mx-auto max-w-5xl">
        <div className="mb-5 text-center">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-[#a78bfa]">See it in action</span>
          <h2 className="mt-2 text-3xl font-semibold text-white">A real Aurora output, from direction to delivery.</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Watch the kind of cinematic performance Aurora is built to take from a creative brief to the feed.
          </p>
        </div>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-[0_24px_80px_-30px_rgba(139,92,246,0.55)]">
          <DemoMedia
            asset={DEMO_ASSETS.landing.walkthrough}
            autoPlay={false}
            controls
            priority
            className="aspect-video w-full object-cover"
          />
        </div>
      </ScrollReveal>
    </section>
  );
}
