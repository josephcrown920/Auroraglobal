import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { runAuroraAgent, type AgentPlan } from "@/lib/agent.functions";
import { Sparkles, Send, Loader2, X, Plus, Wand2, Film, Palette, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Node, Edge } from "@xyflow/react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called when user clicks "Send to canvas" — produces a node graph of all shots. */
  onSendToCanvas: (graph: { nodes: Node<any>[]; edges: Edge[] }) => void;
};

const SAMPLES = [
  "A man and a chimpanzee rob a bank in the Albuquerque desert. Red Ferrari Testarossa. Hard midday sun, 16mm film look.",
  "Music video for a moody R&B track. Rainy Tokyo rooftop, neon reflections, single performer, slow dolly.",
  "UGC ad for a cold brew brand. Sunlit kitchen, hand pours coffee, condensation on glass, golden hour.",
];

export function AuroraAgentPanel({ open, onClose, onSendToCanvas }: Props) {
  const [brief, setBrief] = useState("");
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const runAgent = useServerFn(runAuroraAgent);

  const mut = useMutation({
    mutationFn: async (briefText: string) => runAgent({ data: { brief: briefText } }),
    onSuccess: (p) => { setPlan(p); toast.success(`Plan ready: ${p.shots.length} shots`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendToCanvas = () => {
    if (!plan) return;
    const nodes: Node<any>[] = [
      { id: "in", position: { x: 40, y: 60 }, type: "aurora", data: { kind: "input" } },
    ];
    const edges: Edge[] = [];
    plan.shots.forEach((s, i) => {
      const id = `shot-${i}`;
      nodes.push({
        id,
        position: { x: 380 + (i % 3) * 360, y: 60 + Math.floor(i / 3) * 340 },
        type: "aurora",
        data: { kind: "image", prompt: s.prompt },
      });
      edges.push({ id: `in-${id}`, source: "in", target: id, animated: true });
    });
    onSendToCanvas({ nodes, edges });
    toast.success("Storyboard added to canvas");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-[oklch(0.09_0.03_290/0.97)] backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col animate-slide-in-right">
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/40">
            <Sparkles className="size-4 text-white" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Aurora Agent</p>
            <p className="text-[10px] text-white/50">Your AI co-director</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/5">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {!plan && !mut.isPending && (
          <>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70 leading-relaxed">
              Drop a single paragraph describing your story — characters, location, vibe, era.
              The agent returns a full shot list with ready-to-run prompts, color palette, and next steps.
              Click <span className="text-violet-300">Send to Canvas</span> to wire every shot into your node graph.
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Try a prompt</p>
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setBrief(s)}
                  className="w-full text-left text-xs p-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-violet-400/30 text-white/75"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        {mut.isPending && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-white/70">
            <Loader2 className="size-6 animate-spin text-violet-300" />
            <p className="text-sm">Aurora is building your shot list…</p>
            <p className="text-[10px] text-white/40">Direction · palette · 4-8 shots · prompts</p>
          </div>
        )}

        {plan && !mut.isPending && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-violet-300/80">Concept</p>
              <h3 className="text-lg font-semibold text-white leading-tight">{plan.title}</h3>
              <p className="text-xs text-white/60 mt-1 italic">"{plan.logline}"</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1 inline-flex items-center gap-1"><Lightbulb className="size-3" /> Direction</p>
              <p className="text-xs text-white/80 leading-relaxed">{plan.direction}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 inline-flex items-center gap-1"><Palette className="size-3" /> Color story</p>
              <div className="flex gap-2">
                {plan.palette.map((c) => (
                  <div key={c} className="flex-1">
                    <div className="aspect-square rounded-lg border border-white/10" style={{ background: c }} />
                    <p className="text-[9px] text-white/50 mt-1 text-center font-mono">{c}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 inline-flex items-center gap-1"><Film className="size-3" /> Shot list · {plan.shots.length}</p>
              <div className="space-y-2">
                {plan.shots.map((s) => (
                  <details key={s.id} className="group rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                    <summary className="cursor-pointer p-3 flex items-start gap-2 hover:bg-white/[0.05]">
                      <span className="text-[10px] font-mono text-violet-300 mt-0.5">{s.id}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white leading-tight">{s.title}</p>
                        <p className="text-[10px] text-white/50 mt-0.5">{s.shotType} · {s.camera}</p>
                      </div>
                    </summary>
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-xs text-white/70">{s.action}</p>
                      <div className="rounded-lg bg-black/30 border border-white/5 p-2.5">
                        <p className="text-[9px] uppercase tracking-wider text-emerald-300/70 mb-1">Prompt</p>
                        <p className="text-[11px] text-white/85 leading-relaxed font-mono">{s.prompt}</p>
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(s.prompt); toast.success("Prompt copied"); }}
                        className="text-[10px] text-violet-300 hover:text-violet-200 inline-flex items-center gap-1"
                      >
                        <Wand2 className="size-3" /> Copy prompt
                      </button>
                    </div>
                  </details>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
              <p className="text-[10px] uppercase tracking-wider text-violet-300/80 mb-1.5">Next moves</p>
              <ul className="text-xs text-white/75 space-y-1 list-disc list-inside">
                {plan.suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-white/10 p-3 space-y-2">
        {plan && (
          <Button
            onClick={sendToCanvas}
            className="w-full text-white shadow-lg shadow-violet-500/30"
            style={{ background: "linear-gradient(135deg, oklch(0.65 0.22 305), oklch(0.62 0.22 340))" }}
          >
            <Plus className="size-4 mr-1" /> Send storyboard to canvas
          </Button>
        )}
        <Textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder={plan ? "Refine: 'make shot 3 darker' or send a new brief…" : "Concept: a man and a chimp rob a bank in the desert…"}
          rows={3}
          className="bg-black/30 border-white/10 text-white text-xs resize-none"
        />
        <Button
          onClick={() => { if (brief.trim().length > 3) { setPlan(null); mut.mutate(brief.trim()); } }}
          disabled={mut.isPending || brief.trim().length < 4}
          variant="outline"
          className="w-full border-white/15 bg-white/5 text-white hover:bg-white/10"
        >
          {mut.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Send className="size-3.5 mr-1" />}
          {plan ? "Regenerate plan" : "Direct my story"}
        </Button>
      </footer>
    </div>
  );
}
