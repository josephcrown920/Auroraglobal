import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { auroraChat } from "@/lib/chatbot.functions";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/tracking";

type Msg = { role: "user" | "assistant"; content: string };

const GREETED_KEY = "aurora.chatbot.greeted";
const SHOWN_TIPS_KEY = "aurora.chatbot.shown_tips";
const OFFER_START_KEY = "aurora_offer_start";
const OFFER_DURATION_MS = 1000 * 60 * 60 * 24;

const TIPS_GENERAL = [
  "Stuck? Just tell me the vibe — I'll build your creative brief in 30 seconds. 🎬",
  "Did you know you can lip-sync any face to your track in under 2 minutes? Check the Lipsync tab.",
  "Canvas lets you chain image → video → lip-sync into one pipeline. Want me to walk you through it?",
  "Aurora's UGC Factory turns a product photo into a TikTok-ready ad — want a template to start from?",
  "Colors Studio creates editorial mood boards from a single reference photo. It's worth a look!",
  "Need a full music video? Aurora handles beat-sync, lyric hooks, and cover art. Just drop your track.",
  "The Gallery saves every render you've made — download, share, or remix any of them any time.",
  "Nano Banana Pro is our best identity-locked model. Perfect for keeping your face consistent across multiple shots.",
  "Canvas templates like 'NBA Josh Balloon Head' and 'Cops Chase' are ready to load — tap Finished Workflows on the canvas.",
  "You can upload your own audio to the lip-sync demo and Whisper will auto-transcribe the lyrics for you.",
  "Pro tip: the Studio photo editor can swap outfits, backgrounds, and lighting — all with one prompt.",
];

const TIP_SALE = "⚡ Quick heads-up — your first Aura pack comes with 25% extra Aura free right now. The timer is ticking! Tap Claim to lock it in before it expires.";

function getShownTips(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SHOWN_TIPS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveShownTip(tip: string) {
  try {
    const s = getShownTips();
    s.add(tip);
    sessionStorage.setItem(SHOWN_TIPS_KEY, JSON.stringify([...s]));
  } catch {
    // sessionStorage unavailable — silently skip dedup
  }
}

function isSaleActive(): boolean {
  try {
    const start = Number(localStorage.getItem(OFFER_START_KEY));
    return !!start && Date.now() - start < OFFER_DURATION_MS;
  } catch {
    return false;
  }
}

function pickNextTip(): string {
  const shown = getShownTips();
  const pool = isSaleActive() ? [...TIPS_GENERAL, TIP_SALE] : TIPS_GENERAL;
  const unseen = pool.filter((t) => !shown.has(t));
  const candidates = unseen.length > 0 ? unseen : TIPS_GENERAL;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

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
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openRef = useRef(open);
  openRef.current = open;

  const userMsgCount = messages.filter((m) => m.role === "user").length;
  const userMsgCountRef = useRef(userMsgCount);
  userMsgCountRef.current = userMsgCount;

  const scheduleTip = useCallback(() => {
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    const delay = (5 + Math.random() * 5) * 60 * 1000;
    tipTimerRef.current = setTimeout(() => {
      if (userMsgCountRef.current >= 2) return;
      const tip = pickNextTip();
      saveShownTip(tip);
      if (openRef.current) {
        setMessages((m) => [...m, { role: "assistant", content: tip }]);
      } else {
        toast("Aurora Prime 💬", {
          description: tip,
          duration: 12000,
          action: {
            label: "Open chat",
            onClick: () => setOpen(true),
          },
        });
        void track("chatbot_proactive_tip");
      }
      scheduleTip();
    }, delay);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const init = setTimeout(() => scheduleTip(), 5000);
    return () => {
      clearTimeout(init);
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    };
  }, [scheduleTip]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(GREETED_KEY)) return;
    const id = window.setTimeout(() => {
      const greet = firstName ? `Welcome back, ${firstName} ✨` : "Welcome to Aurora ✨";
      toast(greet, {
        description: "Need help? Tap the chat bubble — Aurora Prime is on call.",
        duration: 6000,
      });
      sessionStorage.setItem(GREETED_KEY, "1");
      void track("chatbot_greeted");
    }, 1800);
    return () => window.clearTimeout(id);
  }, [firstName]);


  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: firstName
            ? `Hey ${firstName} — I'm Aurora Prime, your AI creative director. Drop a vibe, a track, or an idea and I'll build the video, the look, and the moment. What are we making?`
            : `Hey — I'm Aurora Prime, your AI creative director. Drop a vibe, a track, or an idea and I'll build the video, the look, and the moment. What are we making?`,
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
        aria-label={open ? "Close chat" : "Open chat with Aurora Prime"}
        onClick={() => setOpen((o) => !o)}
        className="phone-edge-right fixed bottom-[calc(5rem_+_env(safe-area-inset-bottom))] z-50 size-14 rounded-full flex items-center justify-center text-white shadow-2xl shadow-red-900/50 bg-gradient-to-br from-red-500 to-orange-500 hover:scale-105 transition-transform"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
        {!open && (
          <span className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-400 ring-2 ring-[#070612] animate-pulse" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="phone-edge-right fixed bottom-24 z-50 w-[min(92vw,380px)] h-[min(72vh,560px)] rounded-3xl border border-white/10 bg-[#0c0a1c]/95 backdrop-blur-2xl shadow-2xl shadow-red-950/60 flex flex-col overflow-hidden animate-fade-in">
          <header className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
            <span className="size-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-red-500 to-orange-500">
              <Sparkles className="size-4 text-white" />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">Aurora Prime</div>
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
                    ? "ml-auto bg-gradient-to-br from-red-500 to-orange-500 text-white"
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
              className="flex-1 rounded-full bg-black/30 border border-white/10 focus:border-red-400/60 outline-none px-4 py-2.5 text-sm text-white placeholder:text-white/30"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send"
              className="size-10 rounded-full flex items-center justify-center text-white bg-gradient-to-br from-red-500 to-orange-500 disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
