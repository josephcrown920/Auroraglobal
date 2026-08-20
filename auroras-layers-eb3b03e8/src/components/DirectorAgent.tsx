import { useRef, useState } from "react";
import { sendPromptToStudio } from "@/lib/studioBus";
import { BRAIN_MODELS, DEFAULT_BRAIN_MODEL } from "@/lib/auroraModels";

type Msg = { role: "user" | "assistant"; content: string };

const SEEDS = [
  "Night video for a trap record — rooftop, city haze, one hero shot",
  "Deep blue portrait, iced chain, hard rim light",
  "Train tracks at golden hour, wide 35mm, lonely",
];

function extractPrompt(text: string) {
  const m = text.match(/PROMPT\s*[—:-]\s*([\s\S]*?)(?:\nNEXT|$)/i);
  return (m?.[1] ?? text).trim();
}

export function DirectorAgent() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string>(DEFAULT_BRAIN_MODEL);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (busy || !text.trim()) return;
    const next: Msg[] = [...messages, { role: "user", content: text.trim() }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, model }),
      });
      if (!res.ok || !res.body) throw new Error((await res.text()) || "Director unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta) {
                acc += delta;
                setMessages([...next, { role: "assistant", content: acc }]);
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
              }
            } catch {
              /* keepalive */
            }
          }
        }
      }
      if (!acc) throw new Error("The director didn't respond. Try again.");
    } catch (e) {
      setMessages(next);
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-[family-name:var(--font-mono-ui)] text-[0.65rem] tracking-[0.25em] text-muted-foreground uppercase">
          Aurora Director — cinematic brain
        </p>
        <select
          value={model}
          onChange={(event) => setModel(event.target.value)}
          className="rounded-full border border-border bg-secondary px-3 py-2 font-[family-name:var(--font-mono-ui)] text-[0.65rem] text-foreground outline-none focus:border-primary"
          aria-label="Director brain"
        >
          {BRAIN_MODELS.map((brain) => (
            <option key={brain.id} value={brain.id} disabled={!brain.available}>
              {brain.label}{brain.available ? "" : " · connector required"}
            </option>
          ))}
        </select>
      </div>

      <div
        ref={scrollRef}
        className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1 text-sm"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="text-muted-foreground">
            Describe the feeling, the record, the city. The director returns a logline, lens, light,
            wardrobe, palette and a ready-to-run prompt.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-xl bg-secondary px-3 py-2"
                : "max-w-full rounded-xl border border-border bg-background/60 px-3 py-2"
            }
          >
            <p className="whitespace-pre-wrap">{m.content || (busy ? "Directing…" : "")}</p>
            {m.role === "assistant" && m.content && !busy ? (
              <button
                type="button"
                onClick={() => sendPromptToStudio(extractPrompt(m.content))}
                className="mt-2 rounded-full border border-primary px-3 py-1 text-[0.7rem] font-bold tracking-wider text-primary uppercase transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                ✦ Send prompt to studio
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => send(s)}
            className="rounded-full border border-border px-3 py-1.5 text-[0.7rem] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {s.slice(0, 32)}…
          </button>
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pitch the scene…"
          className="flex-1 rounded-full border border-border bg-secondary/40 px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy}
          className="btn-aurora rounded-full px-5 py-3 text-sm font-bold tracking-wider uppercase disabled:opacity-60"
        >
          {busy ? "…" : "Direct"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
