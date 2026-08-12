import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { FeatureGuard } from "@/components/FeatureVisibilityProvider";
import { ArrowRight, Camera } from "lucide-react";

// Artist-only mode: this feature is hidden from regular users by default.
// Admins always pass; regular users are redirected to /studio unless the
// owner has toggled the feature visible (see feature-visibility registry).
export const Route = createLazyFileRoute("/content")({
  component: () => (
    <FeatureGuard feature="content-funnel">
      <ContentHubPage />
    </FeatureGuard>
  ),
});

const CONTENT_REFERENCES = [
  {
    src: "/content/aurora-tools.jpeg",
    alt: "Aurora tools directory with Perform Anywhere, Colors, TikTok30, Video Agent, Director's Room, Lip Sync, and Motion Control",
    label: "Every tool, built for artists",
  },
  {
    src: "/content/aurora-seedream.jpeg",
    alt: "Aurora creation screen with four visual references and a Seedream 5.0 Lite generate control",
    label: "Start creating from an idea",
  },
  {
    src: "/content/aurora-create.jpeg",
    alt: "Aurora AI image and video creation screen with image and video modes",
    label: "Create images and videos in seconds",
  },
] as const;

function ContentHubPage() {
  return (
    <main className="aurora-page-shell aurora-content-shell min-h-screen text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-28 pt-8 sm:px-8 sm:pt-12">
        <header className="mb-8 max-w-2xl">
          <p className="aurora-kicker">Content</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Create something new.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Explore Aurora’s creative tools and turn your next idea into a finished visual.
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

        <div className="grid gap-5">
          {CONTENT_REFERENCES.map((reference) => (
            <Link
              key={reference.src}
              to="/studio"
              className="group relative block overflow-hidden rounded-3xl border border-white/10 bg-card/60 no-underline shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset] transition hover:-translate-y-0.5 hover:border-primary/40"
            >
              <img
                src={reference.src}
                alt={reference.alt}
                className="block w-full object-cover transition duration-500 group-hover:scale-[1.01]"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-5 pb-5 pt-16">
                <span className="text-sm font-medium text-white">{reference.label}</span>
                <ArrowRight className="size-4 shrink-0 text-white transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
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