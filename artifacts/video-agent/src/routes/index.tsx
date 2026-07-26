import { createFileRoute, Link } from "@tanstack/react-router";
import { Wand2, Images, Bookmark, Library, ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Studio — Dashboard" },
      {
        name: "description",
        content:
          "Your creative operating system for AI. Jump into the playground, browse your gallery, or manage prompts.",
      },
      { property: "og:title", content: "AI Studio — Dashboard" },
      {
        property: "og:description",
        content: "Playground, gallery, references, prompts. One dark studio.",
      },
    ],
  }),
  component: Dashboard,
});

const tiles = [
  {
    title: "Playground",
    desc: "Generate images with streaming previews.",
    to: "/playground",
    icon: Wand2,
  },
  {
    title: "Gallery",
    desc: "Everything you've generated, in one grid.",
    to: "/gallery",
    icon: Images,
  },
  {
    title: "References",
    desc: "Drag & drop moodboard for inspiration.",
    to: "/references",
    icon: Library,
  },
  {
    title: "Prompts",
    desc: "Save, tag, and reuse your best prompts.",
    to: "/prompts",
    icon: Bookmark,
  },
];

function Dashboard() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" /> Creative OS
      </div>
      <h1 className="mt-3 text-5xl font-semibold tracking-tight">
        Welcome back to <span className="text-gradient">AI Studio</span>
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        A dark, glassy workspace for generative creation. Prompt, iterate, and organize —
        without leaving the tab.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {tiles.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group glass rounded-2xl p-6 transition hover:border-primary/40 hover:glow"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/30 to-primary-glow/20 border border-primary/30">
                <t.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
            </div>
            <div className="mt-4 text-lg font-medium">{t.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t.desc}</div>
          </Link>
        ))}
      </div>

      <div className="mt-10 glass rounded-2xl p-6">
        <div className="text-sm font-medium">Quick start</div>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Open the Playground and drop in a prompt.</li>
          <li>Save prompts you love to the Prompt Library.</li>
          <li>Upload references to build your visual language.</li>
        </ol>
      </div>
    </div>
  );
}
