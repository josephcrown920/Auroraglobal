import { createLazyFileRoute } from "@tanstack/react-router";
import { ExternalLink, Github, Wand2, Music2, Waves } from "lucide-react";

export const Route = createLazyFileRoute("/puremix")({
  component: PureMixPage,
});

const REPO = "https://github.com/josephcrown920/PureMix-AI";

function PureMixPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <span className="flex size-12 items-center justify-center rounded-2xl aurora-glass-strong">
          <Waves className="size-6" />
        </span>
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-[#f6d365] via-[#fbbf24] to-[#b8860b] bg-clip-text text-transparent">
            PureMix
          </h1>
          <p className="text-sm text-muted-foreground">
            Open-source AI mixing & mastering — part of Aurora's Artists toolkit.
          </p>
        </div>
      </div>

      <p className="text-base text-foreground/90 mb-6">
        PureMix helps artists turn raw stems into polished, release-ready mixes. It's
        integrated here as an Artists-side companion — pair it with Aurora's Colors
        Sessions, Music Video, and Live Studios flows for a full performance-to-release
        pipeline.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <FeatureCard icon={Music2} title="Stem-aware mixing" body="Balance vocals, drums, and instruments with AI-assisted decisions." />
        <FeatureCard icon={Wand2} title="One-click mastering" body="Get a loudness-matched master ready for streaming." />
        <FeatureCard icon={Waves} title="Open source" body="Fork, self-host, or extend PureMix — MIT-friendly." />
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href={REPO}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl aurora-glass-strong px-4 py-2 text-sm font-semibold text-foreground hover:brightness-110 transition"
        >
          <Github className="size-4" />
          View on GitHub
          <ExternalLink className="size-3.5 opacity-70" />
        </a>
        <a
          href={`${REPO}#readme`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition"
        >
          Read the docs
          <ExternalLink className="size-3.5 opacity-70" />
        </a>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Repo: <code className="rounded bg-muted px-1.5 py-0.5">{REPO}</code>
      </p>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-4 aurora-glass">
      <Icon className="size-5 mb-2 text-primary" />
      <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}
