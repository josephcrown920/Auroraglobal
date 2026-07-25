import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Line = { kind: "in" | "out" | "ok" | "err"; text: string };

const BOOT: Line[] = [{ kind: "out", text: "aurora-cli v1.2.0 — type `help` to see commands" }];

function runCommand(raw: string): Line[] {
  const cmd = raw.trim();
  if (!cmd) return [];
  const out: Line[] = [{ kind: "in", text: cmd }];
  const [head, ...rest] = cmd.split(/\s+/);
  const args = rest.join(" ");
  if (head === "help") {
    out.push({
      kind: "out",
      text: 'commands: login · whoami · generate --prompt "..." --out file.png · video --prompt "..." · lipsync --audio a.mp3 --image i.png · clear',
    });
    return out;
  }
  if (head === "clear") return [];
  const isAurora = head === "aurora";
  if (!isAurora && !["login", "whoami", "generate", "video", "lipsync"].includes(head)) {
    out.push({ kind: "err", text: `command not found: ${head}` });
    return out;
  }
  const sub = isAurora ? rest[0] : head;
  const tail = isAurora ? rest.slice(1).join(" ") : args;
  if (sub === "login") {
    out.push({
      kind: "out",
      text: "→ Visit https://auroraperformancestudio.com/cli/authorize",
    });
    out.push({ kind: "out", text: "→ Enter device code: A7K9-QM3R" });
    out.push({ kind: "ok", text: "✓ Signed in as you@studio" });
  } else if (sub === "whoami") {
    out.push({ kind: "ok", text: "✓ you@studio · 2,500 Aura · plan: Creator" });
  } else if (sub === "generate") {
    const m = tail.match(/--prompt\s+"([^"]+)"/);
    const o = tail.match(/--out\s+(\S+)/);
    out.push({ kind: "out", text: `↻ Rendering: ${m?.[1] ?? "cinematic shot"} (Nano Banana Pro)` });
    out.push({ kind: "ok", text: `✓ Saved to ${o?.[1] ?? "shot.png"} · 10 Aura` });
  } else if (sub === "video") {
    const m = tail.match(/--prompt\s+"([^"]+)"/);
    out.push({
      kind: "out",
      text: `↻ Generating 5s video: ${m?.[1] ?? "cinematic motion"} (Seedance 2.0)`,
    });
    out.push({ kind: "ok", text: "✓ Saved to clip.mp4 · 100 Aura" });
  } else if (sub === "lipsync") {
    out.push({ kind: "out", text: "↻ Aligning audio → mouth shapes (Sync 1.9)" });
    out.push({ kind: "ok", text: "✓ Saved to lipsync.mp4 · 60 Aura" });
  } else {
    out.push({ kind: "err", text: `unknown subcommand: ${sub ?? "(none)"}` });
  }
  return out;
}

type AuroraTerminalProps = {
  /** Tailwind height utility for the scrollable output area. */
  heightClass?: string;
  className?: string;
  title?: string;
};

/**
 * The interactive in-browser Aurora CLI. Self-contained: owns its own command
 * state, scroll-back history and input handling, so it can be dropped into both
 * the landing teaser and the full-size standalone CLI page unchanged.
 */
export function AuroraTerminal({
  heightClass = "h-[320px]",
  className,
  title = "aurora-cli — live",
}: AuroraTerminalProps) {
  const [lines, setLines] = useState<Line[]>(BOOT);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const submit = (raw: string) => {
    if (raw.trim() === "clear") {
      setLines(BOOT);
      return;
    }
    const next = runCommand(raw);
    setLines((prev) => [...prev, ...next]);
    if (raw.trim()) setHistory((h) => [...h, raw]);
    setHIdx(-1);
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "overflow-hidden rounded-2xl border border-white/12 bg-black/70 shadow-2xl shadow-cyan-500/10 cursor-text",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-yellow-300" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
        </div>
        <span className="font-mono text-[11px] text-white/45">{title}</span>
      </div>
      <div
        ref={scrollRef}
        className={cn(
          "overflow-y-auto p-4 font-mono text-xs text-white/85 md:p-6 md:text-[13px] leading-6",
          heightClass,
        )}
      >
        {lines.map((l, i) => (
          <div
            key={i}
            className={
              l.kind === "in"
                ? "text-white"
                : l.kind === "ok"
                  ? "text-emerald-300"
                  : l.kind === "err"
                    ? "text-rose-300"
                    : "text-white/70"
            }
          >
            {l.kind === "in" ? (
              <>
                <span className="text-cyan-300">$</span> {l.text}
              </>
            ) : (
              l.text
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-cyan-300">$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submit(input);
                setInput("");
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (!history.length) return;
                const i = hIdx < 0 ? history.length - 1 : Math.max(0, hIdx - 1);
                setHIdx(i);
                setInput(history[i] ?? "");
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                if (hIdx < 0) return;
                const i = hIdx + 1;
                if (i >= history.length) {
                  setHIdx(-1);
                  setInput("");
                } else {
                  setHIdx(i);
                  setInput(history[i] ?? "");
                }
              }
            }}
            spellCheck={false}
            autoComplete="off"
            placeholder='try: aurora generate --prompt "neon street" --out shot.png'
            className="flex-1 bg-transparent outline-none placeholder:text-white/30"
          />
        </div>
      </div>
    </div>
  );
}
