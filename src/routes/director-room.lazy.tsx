import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { Clapperboard, Film, Sparkles, Wand2, Users } from "lucide-react";

export const Route = createLazyFileRoute("/director-room")({
  component: DirectorRoom,
});

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
}) {
  return (
    <div className="aurora-glass rounded-2xl p-5 flex flex-col gap-2">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15">
        <Icon className="size-5 text-primary" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function DirectorRoom() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Director's Chair
        </span>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight">
          Shoot a{" "}
          <span className="bg-gradient-to-r from-[#f6d365] via-[#fbbf24] to-[#b8860b] bg-clip-text text-transparent">
            $20,000 music video
          </span>{" "}
          for a fraction of the cost.
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Storyboard the scene, cast the lead, block the camera, and render the
          shoot — all in one AI pipeline. Bring the big-budget look without the
          crew, permits, or logistics.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/music-video"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow-soft)] transition hover:brightness-110"
          >
            Start a music video
          </Link>
          <Link
            to="/orchestrate"
            className="rounded-full aurora-glass-strong px-5 py-2.5 text-sm font-semibold transition hover:brightness-110"
          >
            Perform Anywhere
          </Link>
          <Link
            to="/colors"
            className="rounded-full aurora-glass-strong px-5 py-2.5 text-sm font-semibold transition hover:brightness-110"
          >
            Colors Studio
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <Feature
          icon={Clapperboard}
          title="Full-scene storyboarding"
          body="Beat-mapped shot lists with camera direction, wardrobe, and lighting cues — auto-generated from your song or brief."
        />
        <Feature
          icon={Users}
          title="Cast in minutes"
          body="Pick a lead avatar, dial in wardrobe and vibe, and lock consistency across every shot."
        />
        <Feature
          icon={Wand2}
          title="Cinematic camera moves"
          body="Dolly, crane, whip, orbit — cinematic motion applied to any scene with a single tap."
        />
        <Feature
          icon={Film}
          title="Finishing on autopilot"
          body="Colors Studio grading, lipsync, and the aurora finishing stack ship a broadcast-quality cut."
        />
      </section>
    </main>
  );
}
