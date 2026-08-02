import { useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
export type ChatMsg = { role: "user" | "assistant"; content: string; action?: string };
export function AssistantPanel({ messages, busy, onSend }: { messages: ChatMsg[]; busy: boolean; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const send = () => { if (text.trim()) { onSend(text.trim()); setText(""); } };
  return <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-white/55"><Bot className="size-4 text-primary" /> Scene assistant</div>
    <div className="mb-3 max-h-44 space-y-2 overflow-auto">
      {messages.length === 0 && <p className="text-xs leading-relaxed text-white/40">Ask for a cleanup, a new angle, or a sharper export.</p>}
      {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`rounded-lg px-3 py-2 text-xs ${message.role === "user" ? "ml-6 bg-white/8 text-white/80" : "mr-6 bg-primary/10 text-white/70"}`}>{message.content}</div>)}
      {busy && <Loader2 className="size-4 animate-spin text-primary" />}
    </div>
    <div className="flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="What should change?" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none focus:border-primary" /><button onClick={send} disabled={busy} className="rounded-lg bg-primary px-3 text-white"><Send className="size-3.5" /></button></div>
  </section>;
}