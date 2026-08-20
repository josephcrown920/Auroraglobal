import { useRef, useState } from "react";
import { sendStudioCommand } from "@/lib/studioBus";
import { BRAIN_MODELS, DEFAULT_BRAIN_MODEL } from "@/lib/auroraModels";
import { useBibles } from "@/lib/bibleStore";
import { compileIdentityGraph } from "@/lib/characterBible";

type Msg = { role: "user" | "assistant"; content: string };

const SEEDS = [
  "Board a 4-shot night sequence on the rooftop for my trap single",
  "Render a deep blue portrait with iced cuban links, hard rim light",
  "Log my signature fit into the bible: black puffer, red bandana, gold grillz",
];

export function ProductionAgent() {
  const { active } = useBibles();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string>(DEFAULT_BRAIN_MODEL);
  const [actions, setActions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    if (busy || !text.trim()) return;
    const next: Msg[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          model,
          context: active ? compileIdentityGraph(active) : "",
        }),
      });
      if (!res.ok) throw new Error((await res.text()) || "Production agent failed");
      const data = (await res.json()) as {
        content: string;
        calls: { name: string; args: Record<string, unknown> }[];
      };

      const done: string[] = [];
      for (const call of data.calls) {
        if (call.name === "build_storyboard" && Array.isArray(call.args["shots"])) {
          const shots = (call.args["shots"] as { beat: string; prompt: string; motion?: string }[])
            .filter((s) => s?.prompt);
          sendStudioCommand({ type: "storyboard", shots });
          done.push(`Boarded ${shots.length} shots`);
        }
        if (call.name === "render_layer" && typeof call.args["prompt"] === "string") {
          sendStudioCommand({ type: "render", prompt: String(call.args["prompt"]) });
          done.push("Sent a render to the studio");
        }
        if (call.name === "update_bible") {
          sendStudioCommand(
            {
              type: "bible",
              kind: String(call.args["kind"] ?? "wardrobe"),
              label: String(call.args["label"] ?? ""),
              detail: String(call.args["detail"] ?? ""),
            },
            false,
          );
          done.push(`Bible → ${String(call.args["label"] ?? "trait")}`);
        }
      }
      setActions(done);
      setMessages([...next, { role: "assistant", content: data.content || done.join(" · ") || "Done." }]);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Production agent failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-chip">Production agent</span>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="ml-auto rounded-lg border border-border bg-secondary px-2 py-1.5 text-[0.7rem] outline-none focus:border-primary"
        >
          {BRAIN_MODELS.map((b) => (
            <option key={b.id} value={b.id} disabled={!b.available}>
              {b.label}
              {b.available ? "" : " · connector required"}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        It doesn&apos;t just describe the shoot — it boards the sequence, fires renders and writes
        traits into the character bible for you.
      </p>

      <div ref={scrollRef} className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {SEEDS.map((seed) => (
              <button
                key={seed}
                type="button"
                onClick={() => void send(seed)}
                className="rounded-full border border-border px-3 py-1.5 text-left text-[0.7rem] text-muted-foreground hover:border-primary hover:text-primary"
              >
                {seed}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-xl bg-secondary px-3 py-2 text-sm"
                  : "max-w-[92%] rounded-xl border border-border px-3 py-2 text-sm whitespace-pre-wrap"
              }
            >
              {m.content || (busy ? "Directing…" : "")}
            </div>
          ))
        )}
      </div>

      {actions.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {actions.map((a) => (
            <li
              key={a}
              className="rounded-full border border-primary/50 px-3 py-1 text-[0.6rem] tracking-wider text-primary uppercase"
            >
              ✦ {a}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Direct the shoot…"
          className="flex-1 rounded-full border border-border bg-secondary/40 px-4 py-2.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy}
          className="btn-aurora rounded-full px-5 py-2.5 text-[0.7rem] font-bold tracking-wider uppercase disabled:opacity-60"
        >
          {busy ? "…" : "Run"}
        </button>
      </form>
    </div>
  );
}
