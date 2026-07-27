import { ArrowRight, Music, Sparkles, Layers, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onStart: () => void;
  isSignedIn: boolean;
}

export function LandingHero({ onStart }: Props) {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Ambient orbs */}
      <div
        className="aurora-orb"
        style={{ width: 700, height: 700, top: -200, left: "50%", transform: "translateX(-50%)", background: "oklch(0.45 0.18 300 / 0.18)" }}
      />
      <div
        className="aurora-orb"
        style={{ width: 400, height: 400, bottom: -100, right: -100, background: "oklch(0.4 0.15 280 / 0.12)" }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-[--primary] flex items-center justify-center">
            <Music className="size-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight">Aurora Rollout</span>
        </div>
        <a
          href="/"
          className="text-sm text-[--muted-foreground] hover:text-[--foreground] transition-colors"
        >
          ← Back to Aurora
        </a>
      </nav>

      {/* Hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center pt-16 pb-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-[--primary]/30 bg-[--primary]/10 px-4 py-1.5 text-xs font-medium text-[--primary] mb-8">
          <Sparkles className="size-3" />
          Music Video Campaign Studio
        </div>

        <h1 className="max-w-4xl text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05]">
          Create your dream music videos{" "}
          <span className="text-gradient">that look like they cost $20,000.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-[--muted-foreground] leading-relaxed">
          Drop your moodboard, describe your aesthetic, and let Aurora's node pipeline
          generate a full visual rollout — stills, clips, and scenes — with your identity
          locked across every frame.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Button variant="premium" size="xl" onClick={onStart} className="gap-3 px-10">
            Start your rollout
            <ArrowRight className="size-5" />
          </Button>
          <a
            href="/"
            className="text-sm text-[--muted-foreground] hover:text-[--foreground] transition-colors underline underline-offset-4"
          >
            Sign in with Aurora first
          </a>
        </div>

        {/* Feature pills */}
        <div className="mt-16 flex flex-wrap justify-center gap-3 max-w-2xl">
          {[
            { icon: Layers, label: "Node-based pipeline" },
            { icon: Zap, label: "Batch generation" },
            { icon: Music, label: "Character consistency" },
            { icon: Sparkles, label: "AI assistant" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-full border border-[--border] bg-[--card]/60 px-4 py-2 text-sm text-[--muted-foreground]"
            >
              <Icon className="size-3.5 text-[--primary]" />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline preview mockup */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-20">
        <div className="glass rounded-2xl p-6 border border-[--primary]/20">
          <div className="flex items-center justify-between gap-3 overflow-x-auto pb-2">
            {["Brief", "Style", "Character", "Scenes", "Output"].map((node, i) => (
              <div key={node} className="flex items-center gap-3 flex-shrink-0">
                <div className="node-card px-5 py-3 text-center min-w-[100px]">
                  <div
                    className="status-dot mx-auto mb-2"
                    style={{ background: i < 3 ? "oklch(0.72 0.18 145)" : i === 3 ? "oklch(0.72 0.2 300)" : "oklch(0.5 0.02 272)" }}
                  />
                  <div className="text-sm font-medium">{node}</div>
                </div>
                {i < 4 && (
                  <svg width="32" height="12" viewBox="0 0 32 12" className="flex-shrink-0">
                    <line x1="0" y1="6" x2="32" y2="6" stroke="oklch(0.72 0.2 300 / 0.4)" strokeWidth="2" strokeDasharray="4 3" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-[--muted-foreground] text-center">
            Node-based pipeline — Brief → Style → Character → Scenes → Batch Output
          </div>
        </div>
      </div>
    </div>
  );
}
