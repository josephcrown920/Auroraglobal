import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Terminal } from "lucide-react";

type Line = { kind: "in" | "out" | "ok" | "err"; text: string };

const BOOT: Line[] = [
  { kind: "out", text: "aurora-cli v1.2.0 — type `help` to see commands" },
];

function runCommand(raw: string): Line[] {
  const cmd = raw.trim();
  if (!cmd) return [];
  const out: Line[] = [{ kind: "in", text: cmd }];
  const [head, ...rest] = cmd.split(/\s+/);
  const args = rest.join(" ");
  if (head === "help") {
    out.push({ kind: "out", text: 'commands: login · whoami · generate --prompt "..." --out file.png · video --prompt "..." · lipsync --audio a.mp3 --image i.png · clear' });
    return out;
  }
  if (head === "clear") return [];
  const isAurora = head === "aurora";
  if (!isAurora && !["login","whoami","generate","video","lipsync"].includes(head)) {
    out.push({ kind: "err", text: `command not found: ${head}` });
    return out;
  }
  const sub = isAurora ? rest[0] : head;
  const tail = isAurora ? rest.slice(1).join(" ") : args;
  if (sub === "login") {
    out.push({ kind: "out", text: "→ Visit https://aurora-sparkle-charm.lovable.app/cli/authorize" });
    out.push({ kind: "out", text: "→ Enter device code: A7K9-QM3R" });
    out.push({ kind: "ok", text: "✓ Signed in as you@studio" });
  } else if (sub === "whoami") {
    out.push({ kind: "ok", text: "✓ you@studio · 250 Aura · plan: Creator" });
  } else if (sub === "generate") {
    const m = tail.match(/--prompt\s+"([^"]+)"/);
    const o = tail.match(/--out\s+(\S+)/);
    out.push({ kind: "out", text: `↻ Rendering: ${m?.[1] ?? "cinematic shot"} (Nano Banana Pro)` });
    out.push({ kind: "ok", text: `✓ Saved to ${o?.[1] ?? "shot.png"} · 1 Aura` });
  } else if (sub === "video") {
    const m = tail.match(/--prompt\s+"([^"]+)"/);
    out.push({ kind: "out", text: `↻ Generating 5s video: ${m?.[1] ?? "cinematic motion"} (Seedance 2.0)` });
    out.push({ kind: "ok", text: "✓ Saved to clip.mp4 · 5 Aura" });
  } else if (sub === "lipsync") {
    out.push({ kind: "out", text: "↻ Aligning audio → mouth shapes (Sync 1.9)" });
    out.push({ kind: "ok", text: "✓ Saved to lipsync.mp4 · 6 Aura" });
  } else {
    out.push({ kind: "err", text: `unknown subcommand: ${sub ?? "(none)"}` });
  }
  return out;
}

export function CliSection() {
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
    if (raw.trim() === "clear") { setLines(BOOT); return; }
    const next = runCommand(raw);
    setLines((prev) => [...prev, ...next]);
    if (raw.trim()) setHistory((h) => [...h, raw]);
    setHIdx(-1);
  };

  return (
    <section className="relative z-10 mx-4 md:mx-12 my-16 overflow-hidden rounded-[32px] border border-white/10 bg-[#06070d] animate-fade-in">
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: "radial-gradient(circle at 80% 10%, rgba(34,211,238,.22), transparent 34%), radial-gradient(circle at 15% 80%, rgba(168,85,247,.24), transparent 38%)" }} />
      <div className="relative grid gap-8 px-6 py-14 md:grid-cols-[0.9fr_1.1fr] md:px-12 md:py-20 md:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-200">
            <Terminal className="size-3.5" /> Aurora CLI · interactive
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight text-white md:text-5xl">
            A real terminal. Right in your browser.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/68 md:text-lg">
            Type commands, see output, render images, videos and lip-sync — exactly like the installed CLI. Try <code className="text-cyan-300">aurora generate --prompt "neon street"</code> in the terminal.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/studio"
              className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold text-cyan-950 no-underline hover:opacity-95"
            >
              Open Performance Studio <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div
          onClick={() => inputRef.current?.focus()}
          className="overflow-hidden rounded-2xl border border-white/12 bg-black/70 shadow-2xl shadow-cyan-500/10 cursor-text"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-red-400" />
              <span className="size-2.5 rounded-full bg-yellow-300" />
              <span className="size-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="font-mono text-[11px] text-white/45">aurora-cli — live</span>
          </div>
          <div ref={scrollRef} className="h-[320px] overflow-y-auto p-4 font-mono text-xs text-white/85 md:p-6 md:text-[13px] leading-6">
            {lines.map((l, i) => (
              <div key={i} className={
                l.kind === "in" ? "text-white" :
                l.kind === "ok" ? "text-emerald-300" :
                l.kind === "err" ? "text-rose-300" :
                "text-white/70"
              }>
                {l.kind === "in" ? <><span className="text-cyan-300">$</span> {l.text}</> : l.text}
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-cyan-300">$</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { submit(input); setInput(""); }
                  else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    if (!history.length) return;
                    const i = hIdx < 0 ? history.length - 1 : Math.max(0, hIdx - 1);
                    setHIdx(i); setInput(history[i] ?? "");
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (hIdx < 0) return;
                    const i = hIdx + 1;
                    if (i >= history.length) { setHIdx(-1); setInput(""); }
                    else { setHIdx(i); setInput(history[i] ?? ""); }
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
      </div>
    </section>
  );
}