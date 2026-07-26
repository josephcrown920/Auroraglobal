import { createFileRoute } from "@tanstack/react-router";
import { Workflow, Sparkles } from "lucide-react";

export const Route = createFileRoute("/workflows")({
  head: () => ({
    meta: [
      { title: "Workflows — AI Studio" },
      { name: "description", content: "Modular AI workflows and automations." },
      { property: "og:title", content: "Workflows — AI Studio" },
      { property: "og:description", content: "Modular AI workflows and automations." },
    ],
  }),
  component: Workflows,
});

const templates = [
  "Generate Album Cover",
  "Generate Music Video",
  "Generate Character Sheet",
  "Generate 360° Angles",
  "Generate Product Photos",
  "Generate TikTok30",
  "Generate UGC Ads",
  "Generate Thumbnails",
  "Generate Lyrics Video",
];

function Workflows() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Workflows</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Modular pipelines that chain prompts, references, and providers.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t}
            className="glass rounded-xl p-5 text-left transition hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary/30 to-primary-glow/20 border border-primary/30 flex items-center justify-center">
                <Workflow className="h-4 w-4" />
              </div>
              <div className="font-medium">{t}</div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              Template · configure inputs, providers, and outputs.
            </div>
            <div className="mt-3 flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" /> Coming soon
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
