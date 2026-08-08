import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { chainOrder, type Board, type ShotNode } from "@/lib/board-store";

type Proposal = {
  title: string;
  shot_type: string;
  frame: string;
  wardrobe: string;
  mood: string;
  note: string;
  scene: string;
  image_prompt: string;
};

export function DirectorChat({
  board,
  onAccept,
}: {
  board: Board;
  onAccept: (patch: Partial<ShotNode>) => void;
}) {
  const boardContext = chainOrder(board)
    .map((s, i) => `${i + 1}. ${s.title} — ${s.scene} — ${s.mood} (${s.duration}s)`)
    .join("\n");

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    id: board.id,
    transport: new DefaultChatTransport({
      api: "/api/directors-board/chat",
      body: () => ({ boardContext }),
    }),
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    await sendMessage({ text });
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-4 py-3 border-b border-border/60">
        <span className="text-xs uppercase tracking-widest text-primary">Director</span>
        <p className="text-xs text-muted-foreground">
          Ask for shots, pacing, wardrobe. Accept a proposal to chain it onto the board.
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Try: <em>"Give me a rooftop closing shot with pink neon."</em>
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={
                "max-w-[90%] text-sm " +
                (m.role === "user"
                  ? "rounded-2xl px-3.5 py-2 bg-primary text-primary-foreground"
                  : "text-foreground")
              }
            >
              {m.parts.map((p, i) => {
                if (p.type === "text")
                  return m.role === "user" ? (
                    <div key={i} className="whitespace-pre-wrap leading-relaxed">
                      {p.text}
                    </div>
                  ) : (
                    <div
                      key={i}
                      className="leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-semibold"
                    >
                      <ReactMarkdown>{p.text}</ReactMarkdown>
                    </div>
                  );
                if (p.type === "tool-propose_shot") {
                  const proposal = (p as unknown as { input?: Proposal }).input;
                  if (!proposal) return null;
                  return (
                    <div
                      key={i}
                      className="mt-2 rounded-xl border border-border bg-card p-3 space-y-1.5"
                    >
                      <div className="text-[10px] uppercase tracking-widest text-primary">
                        Proposed shot
                      </div>
                      <div className="font-medium">{proposal.title}</div>
                      {proposal.frame && (
                        <div className="text-xs text-muted-foreground">{proposal.frame}</div>
                      )}
                      {proposal.wardrobe && (
                        <div className="text-xs text-muted-foreground">
                          Wardrobe: {proposal.wardrobe}
                        </div>
                      )}
                      {proposal.mood && (
                        <div className="text-xs text-muted-foreground">Mood: {proposal.mood}</div>
                      )}
                      {proposal.note && (
                        <div className="text-xs italic text-muted-foreground/70">
                          {proposal.note}
                        </div>
                      )}
                      <button
                        onClick={() =>
                          onAccept({
                            title: proposal.title,
                            shotType: proposal.shot_type,
                            frame: proposal.frame,
                            wardrobe: proposal.wardrobe,
                            mood: proposal.mood,
                            note: proposal.note,
                            scene: proposal.scene,
                            prompt: proposal.image_prompt,
                          })
                        }
                        className="mt-1 rounded-md bg-primary text-primary-foreground px-2.5 py-1 text-xs font-medium"
                      >
                        Accept shot
                      </button>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
        {busy && (
          <div className="text-xs text-muted-foreground animate-pulse">Director is thinking…</div>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-border/60 p-3 flex gap-2">
        <textarea
          ref={inputRef}
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(e); }
          }}
          placeholder="Ask for a shot idea…"
          className="flex-1 resize-none rounded-lg bg-muted/40 border border-border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="self-end rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
