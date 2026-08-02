import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Camera,
  Clapperboard,
  Flame,
  Layers3,
  Megaphone,
  Mic2,
  ScanFace,
} from "lucide-react";

export const Route = createLazyFileRoute("/content")({ component: ContentHubPage });

const MODES = [
  {
    to: "/ugc",
    label: "UGC Ads",
    description: "Turn a product or idea into a natural creator-style ad.",
    icon: Megaphone,
    accent: "from-red-500/25 to-orange-500/10",
  },
  {
    to: "/spin",
    label: "TikTok30",
    description: "Make a batch of short-form hooks and posts from one concept.",
    icon: Flame,
    accent: "from-amber-500/25 to-red-500/10",
  },
  {
    to: "/ugc-line",
    label: "Content Line",
    description: "Build a repeatable content system around your product.",
    icon: Layers3,
    accent: "from-violet-500/25 to-blue-500/10",
  },
  {
    to: "/avatar",
    label: "Talking Avatars",
    description: "Create presenter videos with a face, voice, and script.",
    icon: ScanFace,
    accent: "from-cyan-500/25 to-blue-500/10",
  },
  {
    to: "/lipsync",
    label: "Lip Sync",
    description: "Give a still or performance clip a matching vocal track.",
    icon: Mic2,
    accent: "from-emerald-500/25 to-cyan-500/10",
  },
  {
    to: "/tiktok",
    label: "TikTok Studio",
    description: "Remix an existing video into platform-ready cuts.",
    icon: Clapperboard,
    accent: "from-pink-500/25 to-purple-500/10",
  },
] as const;

function ContentHubPage() {
  return (
    <main className="aurora-page-shell aurora-content-shell min-h-screen text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-28 pt-8 sm:px-8 sm:pt-12">
        <header className="mb-8 max-w-2xl">
          <p className="aurora-kicker">Content</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            What are you making today?
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Pick the outcome first. Aurora will take you to the right workflow.
          </p>
        </header>

        <section className="aurora-hub-cta mb-8 rounded-3xl border border-primary/25 bg-primary/10 p-5 shadow-[var(--shadow-glow-soft)]">
          <div className="aurora-hub-cta-inner flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary">
                <Camera className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold">Start with a photo or product</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The fastest route to a finished social post is the UGC workflow.
                </p>
              </div>
            </div>
            <Link
              to="/ugc"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground no-underline transition hover:brightness-110"
            >
              Start a UGC ad <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <div className="aurora-hub-grid grid gap-3">
          {MODES.map((mode) => {
            const Icon = mode.icon;
            return (
              <Link
                key={mode.to}
                to={mode.to}
                className={`group rounded-2xl border border-border bg-gradient-to-br ${mode.accent} p-5 no-underline transition hover:-translate-y-0.5 hover:border-primary/40`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-background/50 text-foreground">
                    <Icon className="size-5" />
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
                </div>
                <h2 className="mt-7 font-semibold text-foreground">{mode.label}</h2>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{mode.description}</p>
              </Link>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Need a still, scene, or edit instead?{" "}
          <Link to="/studio" className="font-medium text-primary no-underline hover:underline">
            Open Studio
          </Link>
        </p>
      </div>
    </main>
  );
}