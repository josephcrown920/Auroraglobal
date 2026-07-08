import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  chatWithAuroraAgent,
  listAgentChat,
  clearAgentChat,
  deleteAgentMemory,
  type AgentPlan,
  type AgentChatMessage,
} from "@/lib/agent.functions";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Plus,
  Film,
  Palette,
  Brain,
  MoreVertical,
  Eraser,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { Node, Edge } from "@xyflow/react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called when user clicks "Send to canvas" — produces a node graph of all shots. */
  onSendToCanvas: (graph: { nodes: Node<any>[]; edges: Edge[] }) => void;
};

const SAMPLES = [
  "Plan a music video: moody R&B track, rainy Tokyo rooftop, neon reflections, single performer.",
  "What's the best lens + lighting for a gritty 90s hip-hop look?",
  "Remember this: my visual style is dark cinematic with violet neon accents.",
];

function planToGraph(plan: AgentPlan): { nodes: Node<any>[]; edges: Edge[] } {
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
  return { nodes, edges };
}

function PlanCard({ plan, onSend }: { plan: AgentPlan; onSend: () => void }) {
  return (
    <div className="mt-2 rounded-xl border border-violet-400/25 bg-violet-500/[0.07] overflow-hidden">
      <div className="p-3 space-y-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-violet-300/80">Production plan</p>
          <p className="text-sm font-semibold text-white leading-tight mt-0.5">{plan.title}</p>
          <p className="text-[11px] text-white/55 italic mt-0.5">"{plan.logline}"</p>
        </div>
        <div className="flex items-center gap-1.5">
          {plan.palette.slice(0, 6).map((c) => (
            <span key={c} className="size-4 rounded-full border border-white/15" style={{ background: c }} title={c} />
          ))}
          <span className="text-[9px] text-white/40 ml-1 inline-flex items-center gap-1">
            <Palette className="size-2.5" /> color story
          </span>
        </div>
        <details className="group">
          <summary className="cursor-pointer text-[11px] text-white/70 inline-flex items-center gap-1.5 hover:text-white">
            <Film className="size-3 text-violet-300" /> {plan.shots.length} shots — tap to view
          </summary>
          <div className="mt-2 space-y-1.5">
            {plan.shots.map((s) => (
              <div key={s.id} className="rounded-lg bg-black/30 border border-white/5 p-2">
                <p className="text-[11px] font-medium text-white leading-tight">
                  <span className="font-mono text-violet-300 mr-1">{s.id}</span>
                  {s.title}
                </p>
                <p className="text-[10px] text-white/45 mt-0.5">{s.shotType} · {s.camera}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(s.prompt); toast.success("Prompt copied"); }}
                  className="mt-1 text-[10px] text-violet-300 hover:text-violet-200"
                >
                  Copy prompt
                </button>
              </div>
            ))}
          </div>
        </details>
      </div>
      <button
        onClick={onSend}
        className="w-full py-2 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 hover:brightness-110 transition-[filter]"
        style={{ background: "linear-gradient(135deg, oklch(0.65 0.22 305), oklch(0.62 0.22 340))" }}
      >
        <Plus className="size-3.5" /> Send storyboard to canvas
      </button>
    </div>
  );
}

export function AuroraAgentPanel({ open, onClose, onSendToCanvas }: Props) {
  const [draft, setDraft] = useState("");
  const [pendingUserMsg, setPendingUserMsg] = useState<string | null>(null);
  const chatFn = useServerFn(chatWithAuroraAgent);
  const listFn = useServerFn(listAgentChat);
  const clearFn = useServerFn(clearAgentChat);
  const forgetFn = useServerFn(deleteAgentMemory);
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const history = useQuery({
    queryKey: ["agent-chat"],
    enabled: open,
    queryFn: () => listFn({}),
  });
  const messages: AgentChatMessage[] = history.data?.messages ?? [];
  const hasMemory = history.data?.hasMemory ?? false;

  const sendMut = useMutation({
    mutationFn: async (message: string) => chatFn({ data: { message } }),
    onSuccess: (res) => {
      setPendingUserMsg(null);
      qc.invalidateQueries({ queryKey: ["agent-chat"] });
      if (res.memoryUpdated) toast.success("Aurora updated its memory of you", { icon: "🧠" });
    },
    onError: (e: Error) => {
      setPendingUserMsg(null);
      toast.error(e.message);
    },
  });

  const clearMut = useMutation({
    mutationFn: async () => clearFn({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-chat"] });
      toast.success("Chat cleared — memory kept");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const forgetMut = useMutation({
    mutationFn: async () => forgetFn({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-chat"] });
      toast.success("Memory erased");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const send = () => {
    const text = draft.trim();
    if (text.length < 2 || sendMut.isPending) return;
    setPendingUserMsg(text);
    setDraft("");
    sendMut.mutate(text);
  };

  // Keep the thread pinned to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pendingUserMsg, sendMut.isPending, open]);

  if (!open) return null;

  return (
    <div className="phone-panel-col fixed inset-y-0 z-50 bg-[oklch(0.09_0.03_290/0.97)] backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col animate-slide-in-right">
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/40">
            <Sparkles className="size-4 text-white" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Aurora Agent</p>
            <p className="text-[10px] text-white/50 inline-flex items-center gap-1">
              {hasMemory ? (
                <>
                  <Brain className="size-2.5 text-violet-300" />
                  <span className="text-violet-300/90">Remembers you</span>
                </>
              ) : (
                "Your AI co-director"
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/5" aria-label="Chat options">
                <MoreVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onSelect={() => clearMut.mutate()}
                disabled={clearMut.isPending || messages.length === 0}
              >
                <Eraser className="size-3.5 mr-2" /> Clear chat (keep memory)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => forgetMut.mutate()}
                disabled={forgetMut.isPending || !hasMemory}
                className="text-rose-400 focus:text-rose-300"
              >
                <Trash2 className="size-3.5 mr-2" /> Forget everything about me
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button onClick={onClose} className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/5" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {history.isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="size-5 animate-spin text-violet-300" />
          </div>
        )}

        {!history.isLoading && messages.length === 0 && !pendingUserMsg && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70 leading-relaxed">
              I'm your permanent co-director — I remember your style, characters and projects across every
              conversation. Talk shop, ask for looks and lenses, or say{" "}
              <span className="text-violet-300">"plan a video…"</span> and I'll build a full shot list you can
              send straight to the canvas.
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Try saying</p>
              {SAMPLES.map((s) => (
                <button
                  key={s}
                  onClick={() => setDraft(s)}
                  className="w-full text-left text-xs p-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-violet-400/30 text-white/75"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-xs leading-relaxed text-white bg-gradient-to-br from-violet-600/80 to-fuchsia-600/70 border border-violet-400/20"
                  : "max-w-[92%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-xs leading-relaxed text-white/85 bg-white/[0.05] border border-white/10"
              }
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === "assistant" && m.plan && (
                <PlanCard
                  plan={m.plan}
                  onSend={() => {
                    onSendToCanvas(planToGraph(m.plan!));
                    toast.success("Storyboard added to canvas");
                    onClose();
                  }}
                />
              )}
            </div>
          </div>
        ))}

        {pendingUserMsg && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-xs leading-relaxed text-white bg-gradient-to-br from-violet-600/80 to-fuchsia-600/70 border border-violet-400/20 opacity-80">
              <p className="whitespace-pre-wrap">{pendingUserMsg}</p>
            </div>
          </div>
        )}

        {sendMut.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white/[0.05] border border-white/10 inline-flex items-center gap-2 text-xs text-white/60">
              <Loader2 className="size-3 animate-spin text-violet-300" /> Aurora is thinking…
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-white/10 p-3 space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Talk to your co-director…"
          rows={2}
          className="bg-black/30 border-white/10 text-white text-xs resize-none"
        />
        <Button
          onClick={send}
          disabled={sendMut.isPending || draft.trim().length < 2}
          className="w-full text-white shadow-lg shadow-violet-500/30"
          style={{ background: "linear-gradient(135deg, oklch(0.65 0.22 305), oklch(0.62 0.22 340))" }}
        >
          {sendMut.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Send className="size-3.5 mr-1" />}
          Send
        </Button>
      </footer>
    </div>
  );
}
