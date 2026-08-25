import React, { useRef, useState, useEffect } from "react";
import { Send, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendAssistantMessage } from "@/lib/api";
import type { AssistantContext, AssistantScene } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface Message {
  role: "user" | "ai" | "error";
  content: string;
}

interface Props {
  artistName: string;
  brief: string;
  mood: string;
  scenes: AssistantScene[];
  messages: Message[];
  onMessagesChange: (msgs: Message[]) => void;
}

const SUGGESTIONS_BY_MOOD: Record<string, string[]> = {
  Cinematic: ["Slow push-in opener", "Wide anamorphic establish", "Golden-hour silhouette"],
  "Dark Trap": ["Low-angle performance shot", "Handheld alley tracking", "Hard-light closeup"],
  "Lo-Fi": ["Static room portrait", "Soft handheld detail", "Grainy over-the-shoulder"],
  Luxury: ["Dolly through the set", "Polished product closeup", "Slow-motion fabric detail"],
  Street: ["Whip-pan transition", "Low-angle street walk", "Candid long-lens reaction"],
  Afrobeats: ["Dance-floor wide shot", "Circular camera move", "Rhythmic cutaway detail"],
  default: ["Wide establishing shot", "Tight closeup", "Motion blur tracking"],
};

export function AssistantSidebar({ artistName, brief, mood, scenes, messages, onMessagesChange }: Props) {
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userMsg: Message = { role: "user", content: inputValue.trim() };
    const newMsgs = [...messages, userMsg];
    onMessagesChange(newMsgs);
    setInputValue("");
    setIsTyping(true);

    try {
      const context: AssistantContext = { artistName, brief, mood, scenes };
      const reply = await sendAssistantMessage(newMsgs, context);
      onMessagesChange([...newMsgs, { role: "ai", content: reply }]);
    } catch (err) {
      onMessagesChange([...newMsgs, { role: "error", content: "Failed to connect to the assistant. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full h-full flex flex-col glass border-l border-border overflow-hidden relative">
      <div className="p-4 border-b border-border flex items-center gap-2 shrink-0">
        <Sparkles className="size-4 text-primary" />
        <h2 className="font-semibold text-sm">Director's AI</h2>
      </div>

      <div className="flex-1 panel-scroll p-4 space-y-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="chat-bubble-ai p-3 text-sm">
              Hi! I'm your creative director for this rollout. Tell me your brief and I'll suggest shot types, scene ideas, and visual directions.
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] p-3 text-sm flex flex-col gap-1",
                msg.role === "user" ? "chat-bubble-user ml-auto" : "chat-bubble-ai mr-auto",
                msg.role === "error" && "bg-destructive/10 border-destructive/30 text-destructive"
              )}
            >
              {msg.role === "error" && <AlertCircle className="size-4 mb-1" />}
              {msg.content}
            </div>
          ))
        )}
        
        {isTyping && (
          <div className="chat-bubble-ai mr-auto p-3 max-w-[85%] text-sm flex gap-1 items-center h-10">
            <div className="size-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="size-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="size-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border shrink-0 bg-card/30">
        <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar snap-x">
          {(SUGGESTIONS_BY_MOOD[mood] ?? SUGGESTIONS_BY_MOOD.default).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setInputValue(s)}
              className="snap-start shrink-0 text-[10px] px-2.5 py-1 rounded-full border border-border bg-card hover:border-primary/50 text-muted-foreground whitespace-nowrap transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
        
        <form onSubmit={handleSubmit} className="flex gap-2 relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe a scene or ask for ideas..."
            className="flex min-h-[44px] max-h-[120px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none py-3 pr-10"
            rows={1}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50 transition-opacity hover:bg-primary/90"
          >
            {isTyping ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
