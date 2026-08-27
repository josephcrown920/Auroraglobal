// Sparkle-button Assistant panel — plain-English requests that turn directly
// into Canvas nodes through the same generate pipeline the toolbar uses.
import { useRef, useState } from "react";
import { Sparkles, X, Send, Bot, User as UserIcon } from "lucide-react";
import { MODELS } from "@/lib/models";
import { parseAssistantCommand } from "./parseCommand";
import type { AddStepValue } from "@/components/canvas/AddStepPopover";
import type { ShotNode, MediaKind } from "@/components/canvas/types";

interface ChatMsg {
  role: "user" | "assistant";
  text: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  nodes: ShotNode[];
  onCreateNode: (flowX: number, flowY: number, value: AddStepValue, parentId?: string) => string;
  onOpenConnect: () => void;
  onResult: (r: { nodeId: string; kind: MediaKind }) => void;
}

const ROSTER_HINT = `Your roster: ${MODELS.map((m) => `@${m.handle}`).join(", ")}.`;

export function AssistantPanel({ open, onClose, nodes, onCreateNode }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      text: `Tell me what to create — e.g. "make 4 beach shots of @${MODELS[0].handle}" or "turn this into a video". ${ROSTER_HINT}`,
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  function push(msg: ChatMsg) {
    setMessages((m) => [...m, msg]);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
  }

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    push({ role: "user", text });

    const action = parseAssistantCommand(text);
    if (action.type === "needs-model") {
      push({
        role: "assistant",
        text: `I don't see "@${action.mention}" in your roster. ${ROSTER_HINT} Try again with one of those.`,
      });
      return;
    }
    if (action.type === "unrecognized") {
      push({
        role: "assistant",
        text: `I can generate shots or turn a shot into video. Try "make 3 golden hour shots of @${MODELS[0].handle}" or "turn the last shot into a video".`,
      });
      return;
    }
    if (action.type === "video-from-last") {
      const last = [...nodes].reverse().find((n) => n.data.status === "done" && n.data.mediaType === "image");
      if (!last) {
        push({ role: "assistant", text: "I don't have a finished image on the Canvas yet to turn into a video. Generate one first." });
        return;
      }
      const baseX = last.position.x + 220;
      const baseY = last.position.y;
      onCreateNode(baseX, baseY, {
        modelId: last.data.modelId,
        lookId: (last.data.lookId as AddStepValue["lookId"]) ?? "boudoir",
        prompt: "Animate with subtle natural motion",
        kind: "video",
      }, last.id);
      push({ role: "assistant", text: "On it — animating that shot into a short video on the Canvas." });
      return;
    }

    // action.type === "generate"
    const model = MODELS.find((m) => m.id === action.modelId)!;
    const anchor = nodes.length ? nodes[nodes.length - 1] : undefined;
    const baseX = anchor ? anchor.position.x + 220 : 40;
    const baseY = anchor ? anchor.position.y + 40 : 40;
    for (let i = 0; i < action.count; i++) {
      onCreateNode(baseX + i * 150, baseY + 180, {
        modelId: action.modelId,
        lookId: action.lookId,
        prompt: action.prompt,
        kind: action.mediaKind,
      });
    }
    push({
      role: "assistant",
      text: `Generating ${action.count} ${action.mediaKind === "video" ? "video" : "shot"}${action.count > 1 ? "s" : ""} of ${model.name} — watch them land on the Canvas.`,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[340px] flex-col border-l border-white/10 bg-[#0a050d]/97 shadow-2xl backdrop-blur-xl animate-fade-in">
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-fuchsia-400" />
          <span className="text-[13px] font-bold">Assistant</span>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white">
          <X size={15} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${m.role === "user" ? "bg-white/10" : "bg-fuchsia-500/20"}`}>
              {m.role === "user" ? <UserIcon size={10} /> : <Bot size={10} className="text-fuchsia-300" />}
            </div>
            <div className={`max-w-[240px] rounded-xl px-3 py-2 text-[12px] leading-snug ${m.role === "user" ? "bg-white/10 text-white" : "bg-fuchsia-500/10 text-white/90"}`}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-white/8 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={`Create 4 beach shots of @${MODELS[0].handle}…`}
          className="flex-1 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-[12px] text-white placeholder:text-white/25 outline-none focus:border-fuchsia-400/50"
        />
        <button
          onClick={handleSend}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white"
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
}
