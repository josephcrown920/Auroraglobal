import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { auroraChat } from "@/lib/chatbot.functions";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/tracking";

type Msg = { role: "user" | "assistant"; content: string };

const GREETED_KEY = "aurora.chatbot.greeted";

export function AuroraChatbot() {
  const { user } = useAuth();
  const chat = useServerFn(auroraChat);
  const firstName =
    (user?.user_metadata?.display_name as string | undefined)?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    undefined;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Welcome toast once per visitor session
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(GREETED_KEY)) return;
    const id = window.setTimeout(() => {
      const greet = firstName
        ? `Welcome back, ${firstName} ✨`
        : "Welcome to Aurora ✨";
      toast(greet, {
        description: "Need help? Tap the chat bubble — Aurora Concierge is on call.",
        duration: 6000,
      });
      sessionStorage.setItem(GREETED_KEY, "1");
      void track("chatbot_greeted");
    }, 1800);
    return () => window.clearTimeout(id);
  }, [firstName]);

  // Seed first assistant message when opened
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: firstName
            ? `Hey ${firstName} — I'm Aurora Concierge. Want to make a music video, a lip-sync clip, a UGC ad, or an editorial cover? Tell me the vibe and I'll point you to the right tool.`
            : `Hi! I'm Aurora Concierge. Tell me what you want to make — music video, lip-sync, UGC ad, editorial cover — and I'll guide you.`,
        },
      ]);
      void track("chatbot_opened");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, firstName, messages.length]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    void track("chatbot_message_sent", { length: text.length });
    try {
      const { reply } = await chat({ data: { firstName, messages: next } });
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setMessages((m) => [...m, { role: "assistant", content: `⚠ ${msg}` }]);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        aria-label={open ? "Close chat" : "Open chat with Aurora Concierge"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 size-14 rounded-full flex items-center justify-center text-white shadow-2xl shadow-violet-900/50 bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:scale-105 transition-transform"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        {!open && (
          <span className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-400 ring-2 ring-[#070612] animate-pulse" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[min(92vw,380px)] h-[min(72vh,560px)] rounded-3xl border border-white/10 bg-[#0c0a1c]/95 backdrop-blur-2xl shadow-2xl shadow-violet-950/60 flex flex-col overflow-hidden animate-fade-in">
          <header className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
            <span className="size-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Sparkles className="size-4 text-white" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Aurora Concierge</div>
              <div className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-400" /> Online · replies instantly
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="size-8 rounded-full hover:bg-white/5 text-white/60 flex items-center justify-center"
            >
              <X className="size-4" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
                    : "bg-white/[0.06] border border-white/10 text-white/90"
                }`}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="bg-white/[0.06] border border-white/10 rounded-2xl px-3.5 py-2.5 text-sm text-white/60 inline-flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" /> Aurora is thinking…
              </div>
            )}
          </div>

          <form onSubmit={send} className="border-t border-white/10 p-3 flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1500}
              placeholder="Ask Aurora anything…"
              className="flex-1 rounded-full bg-black/30 border border-white/10 focus:border-violet-400/60 outline-none px-4 py-2.5 text-sm text-white placeholder:text-white/30"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="size-10 rounded-full flex items-center justify-center text-white bg-gradient-to-br from-violet-500 to-fuchsia-500 disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
