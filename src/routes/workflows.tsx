import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listWorkflows, saveWorkflow, deleteWorkflow } from "@/lib/workflows.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SiteFooter } from "@/components/SiteFooter";
import { Plus, Trash2, Workflow as WfIcon, ExternalLink, Sparkles, Image as ImageIcon, Video, Mic2, Eye, Wand2, Layers } from "lucide-react";

const FEATURED_TEMPLATES: Array<{
  slug: string;
  name: string;
  description: string;
  icon: typeof Sparkles;
  accent: string;
  graph: Record<string, unknown>;
}> = [
  { slug: "drift-moodboard", name: "Drift Moodboard", description: "4 stills → cohesive cinematic moodboard with color script.", icon: ImageIcon, accent: "from-violet-500 to-fuchsia-500", graph: { nodes: [{ type: "moodboard", count: 4 }], edges: [] } },
  { slug: "skatepark-reel", name: "Skatepark Reel", description: "Identity ref → 6-shot skate sequence, slow-mo finisher.", icon: Video, accent: "from-amber-500 to-orange-500", graph: { nodes: [{ type: "performance" }, { type: "video", shots: 6 }], edges: [] } },
  { slug: "competitor-scan", name: "Competitor Scan", description: "Pull 8 references from a brand URL → style breakdown.", icon: Eye, accent: "from-sky-500 to-cyan-500", graph: { nodes: [{ type: "scrape" }, { type: "analyze" }], edges: [] } },
  { slug: "vocal-sync-music-video", name: "Vocal Sync Music Video", description: "Performance clip + vocal stem → frame-perfect lip-sync render.", icon: Mic2, accent: "from-pink-500 to-rose-500", graph: { nodes: [{ type: "lipsync", engine: "sync-v2" }], edges: [] } },
  { slug: "one-click-trailer", name: "One-Click Trailer", description: "Single prompt → 8s teaser with motion + score.", icon: Wand2, accent: "from-emerald-500 to-teal-500", graph: { nodes: [{ type: "video", duration: 8 }], edges: [] } },
  { slug: "split-reality", name: "Split Reality", description: "Day/night split of the same scene for before/after reveals.", icon: Layers, accent: "from-indigo-500 to-purple-500", graph: { nodes: [{ type: "split", variants: 2 }], edges: [] } },
];

export const Route = createFileRoute("/workflows")({
  component: WorkflowsPage,
  head: () => ({
    meta: [
      { title: "Workflows — Aurora Studio" },
      { name: "description", content: "Save, share, and re-run your Aurora generation graphs across image, video and lip-sync models." },
      { property: "og:title", content: "Aurora Workflows" },
      { property: "og:description", content: "Reusable multi-model AI workflows you can save, share and re-run." },
      { property: "og:url", content: "https://aurorastudiostar.lovable.app/workflows" },
    ],
    links: [{ rel: "canonical", href: "https://aurorastudiostar.lovable.app/workflows" }],
  }),
});

function WorkflowsPage() {
  const list = useServerFn(listWorkflows);
  const save = useServerFn(saveWorkflow);
  const del = useServerFn(deleteWorkflow);
  const [items, setItems] = useState<Array<{ id: string; name: string; description: string | null; is_public: boolean; updated_at: string; user_id: string }>>([]);

  const refresh = () => list({}).then(r => setItems(r.workflows as never)).catch(() => {});
  useEffect(() => { refresh(); }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold text-foreground no-underline">Aurora</Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/studio" className="text-foreground/70 no-underline">Studio</Link>
          <Link to="/canvas" className="text-foreground/70 no-underline">Canvas</Link>
          <Link to="/gallery" className="text-foreground/70 no-underline">Gallery</Link>
        </nav>
      </header>
      <section className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><WfIcon className="h-7 w-7 text-primary" /> Workflows</h1>
            <p className="text-muted-foreground text-sm mt-1">Reusable generation graphs. Build them in Canvas and save here.</p>
          </div>
          <Button onClick={async () => {
            const name = prompt("Workflow name?");
            if (!name) return;
            await save({ data: { name, graph: { nodes: [], edges: [] }, is_public: false } });
            toast.success("Workflow created");
            refresh();
          }}><Plus className="h-4 w-4 mr-1" /> New</Button>
        </div>

        {/* Featured templates */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">Featured templates</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURED_TEMPLATES.map((tpl) => (
              <button
                key={tpl.slug}
                onClick={async () => {
                  try {
                    await save({ data: { name: tpl.name, description: tpl.description, graph: tpl.graph, is_public: false } });
                    toast.success(`Added "${tpl.name}" to your workflows`);
                    refresh();
                  } catch {
                    toast.error("Sign in to save templates");
                  }
                }}
                className="group text-left rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/50 transition-all hover:-translate-y-0.5"
              >
                <div className={`h-20 bg-gradient-to-br ${tpl.accent} relative flex items-end p-3`}>
                  <tpl.icon className="h-6 w-6 text-white drop-shadow" />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">{tpl.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tpl.description}</p>
                  <p className="text-[11px] text-primary/80 mt-2 inline-flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Use template
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <WfIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">Your workflows</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {items.length === 0 && <p className="text-muted-foreground col-span-2 text-sm">No workflows yet. Pick a template above or <Link to="/canvas" className="text-primary">open Canvas</Link>.</p>}
          {items.map(w => (
            <div key={w.id} className="border border-border rounded-xl p-4 bg-card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{w.name}</h3>
                  <p className="text-xs text-muted-foreground">{w.description ?? "—"}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={async () => {
                  if (!confirm("Delete?")) return;
                  await del({ data: { id: w.id } });
                  refresh();
                }}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(w.updated_at).toLocaleDateString()}</span>
                <Link to="/canvas" search={{ wf: w.id } as never} className="text-primary inline-flex items-center gap-1">Open <ExternalLink className="h-3 w-3" /></Link>
              </div>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter tone="light" />
    </main>
  );
}
