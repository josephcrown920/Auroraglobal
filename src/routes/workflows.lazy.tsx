import { createLazyFileRoute, Link } from "@tanstack/react-router";
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
  { slug: "drift-moodboard", name: "Drift Moodboard", description: "4 stills → cohesive cinematic moodboard with color script.", icon: ImageIcon, accent: "from-brand to-orange-400", graph: { nodes: [{ type: "moodboard", count: 4 }], edges: [] } },
  { slug: "skatepark-reel", name: "Skatepark Reel", description: "Identity ref → 6-shot skate sequence, slow-mo finisher.", icon: Video, accent: "from-amber-500 to-orange-500", graph: { nodes: [{ type: "performance" }, { type: "video", shots: 6 }], edges: [] } },
  { slug: "competitor-scan", name: "Competitor Scan", description: "Pull 8 references from a brand URL → style breakdown.", icon: Eye, accent: "from-sky-500 to-cyan-500", graph: { nodes: [{ type: "scrape" }, { type: "analyze" }], edges: [] } },
  { slug: "vocal-sync-music-video", name: "Vocal Sync Music Video", description: "Performance clip + vocal stem → frame-perfect lip-sync render.", icon: Mic2, accent: "from-pink-500 to-rose-500", graph: { nodes: [{ type: "lipsync", engine: "sync-v2" }], edges: [] } },
  { slug: "one-click-trailer", name: "One-Click Trailer", description: "Single prompt → 8s teaser with motion + score.", icon: Wand2, accent: "from-emerald-500 to-teal-500", graph: { nodes: [{ type: "video", duration: 8 }], edges: [] } },
];

export const Route = createLazyFileRoute("/workflows")({ component: WorkflowsPage });

function WorkflowsPage() {
  const list = useServerFn(listWorkflows);
  const save = useServerFn(saveWorkflow);
  const del = useServerFn(deleteWorkflow);
  const [items, setItems] = useState<Array<{ id: string; name: string; description: string | null; is_public: boolean; updated_at: string; user_id: string }>>([]);

  const refresh = () => list({}).then(r => setItems(r.workflows as never)).catch(() => {});
  useEffect(() => { refresh(); }, []);

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />
      <header className="relative z-10 border-b border-border/40 bg-background/70 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold text-foreground no-underline">Aurora</Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/studio" className="text-foreground/70 no-underline">Studio</Link>
          <Link to="/canvas" className="text-foreground/70 no-underline">Canvas</Link>
          <Link to="/gallery" className="text-foreground/70 no-underline">Gallery</Link>
        </nav>
      </header>
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><WfIcon className="h-7 w-7 text-primary" /> Workflows</h1>
            <p className="text-muted-foreground text-sm mt-1">Reusable generation graphs. Build them in Canvas and save here.</p>
          </div>
          <Button variant="premium" onClick={async () => {
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
            <h2 className="aurora-kicker">Featured templates</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
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
                className="group relative aspect-[4/3] rounded-2xl overflow-hidden text-left transition-all ring-1 ring-white/10 hover:ring-primary/50"
              >
                {/* Full-bleed gradient background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${tpl.accent} transition-transform duration-500 group-hover:scale-[1.04]`} />

                {/* Dark overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                {/* Icon top-left */}
                <div className="absolute top-4 left-4 size-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <tpl.icon className="size-5 text-white drop-shadow" />
                </div>

                {/* Text overlay bottom */}
                <div className="absolute bottom-0 inset-x-0 p-4">
                  <h3 className="font-bold text-white text-sm leading-snug mb-0.5">{tpl.name}</h3>
                  <p className="text-[11px] text-white/60 line-clamp-1">{tpl.description}</p>
                  <p className="text-[10px] text-white/40 mt-1.5 inline-flex items-center gap-1">
                    <Plus className="size-3" /> Use template →
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <WfIcon className="h-4 w-4 text-primary" />
          <h2 className="aurora-kicker">Your workflows</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {items.length === 0 && <p className="text-muted-foreground col-span-2 text-sm">No workflows yet. Pick a template above or <Link to="/canvas" className="text-primary">open Canvas</Link>.</p>}
          {items.map(w => (
            <div key={w.id} className="aurora-glass rounded-xl p-4">
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
