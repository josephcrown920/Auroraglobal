import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";

/**
 * Landing page section showcasing the Split Reality feature.
 * Two parallel AI renders from the same reference: one hyper-real,
 * one cinematic. Used on the main index landing page.
 */
export function SplitReality() {
  return (
    <section className="relative py-20 px-5 overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute right-1/4 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-cyan-500/6 blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary mb-4">
            <Wand2 className="size-3" /> Split Reality
          </span>
          <h2 className="text-[clamp(28px,4vw,48px)] font-semibold leading-[1.1] mb-4">
            Two worlds.<br />One reference.
          </h2>
          <p className="max-w-[52ch] mx-auto text-base leading-relaxed text-muted-foreground">
            Upload one photo and Aurora generates two parallel realities side by side —
            an ultra-real mirror selfie and a cinematic anamorphic close-up. Or put two
            characters in the same scene living completely different lives.
          </p>
        </div>

        {/* Demo grid */}
        <div className="grid grid-cols-2 gap-2 rounded-3xl overflow-hidden border border-border/50 shadow-[0_0_60px_-20px_oklch(0.72_0.2_300_/_0.15)] max-w-2xl mx-auto mb-10">
          <div className="relative bg-zinc-900 aspect-square">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-zinc-800 mx-auto animate-pulse" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">Ultra-Real</p>
              </div>
            </div>
            <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
              Mirror
            </div>
          </div>
          <div className="relative bg-zinc-950 aspect-square">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-full bg-zinc-800/60 mx-auto animate-pulse [animation-delay:200ms]" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">Cinematic</p>
              </div>
            </div>
            <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
              Anamorphic
            </div>
          </div>
        </div>

        <div className="text-center">
          <Button asChild variant="premium" className="text-base px-8 py-6 rounded-2xl">
            <Link to="/split-reality">Try Split Reality</Link>
          </Button>
          <p className="text-xs text-muted-foreground mt-3">~20 Aura · two images rendered in parallel</p>
        </div>
      </div>
    </section>
  );
}
