import { useEffect, useRef } from "react";
import { Loader2, Terminal, Image as ImageIcon, Film, Music, Link as LinkIcon } from "lucide-react";
import type { SandboxEvent, LogLevel } from "@/lib/playground/sandbox";

export type ConsoleEntry =
  | { id: number; type: "console"; level: LogLevel; text: string }
  | { id: number; type: "api-call"; path: string; summary: string }
  | { id: number; type: "progress"; current: number; total: number; label?: string }
  | { id: number; type: "result"; url: string; kind?: string; label?: string }
  | { id: number; type: "status"; text: string; tone: "ok" | "error" | "info" };

let entrySeq = 0;
export function nextEntryId() {
  return ++entrySeq;
}

export function entryFromEvent(ev: SandboxEvent): ConsoleEntry | null {
  switch (ev.type) {
    case "console":
      return { id: nextEntryId(), type: "console", level: ev.level, text: ev.text };
    case "api-call":
      return { id: nextEntryId(), type: "api-call", path: ev.path, summary: ev.summary };
    case "progress":
      return { id: nextEntryId(), type: "progress", current: ev.current, total: ev.total, label: ev.label };
    case "result":
      return { id: nextEntryId(), type: "result", url: ev.url, kind: ev.kind, label: ev.label };
    case "done":
      return { id: nextEntryId(), type: "status", text: "Script finished", tone: "ok" };
    case "error":
      return { id: nextEntryId(), type: "status", text: ev.message, tone: "error" };
    default:
      return null;
  }
}

function guessKind(url: string, kind?: string): "image" | "video" | "audio" | "link" {
  if (kind === "image" || kind === "video" || kind === "audio") return kind;
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|webp|gif|avif)$/.test(clean)) return "image";
  if (/\.(mp4|webm|mov)$/.test(clean)) return "video";
  if (/\.(mp3|wav|ogg|m4a)$/.test(clean)) return "audio";
  return "link";
}

function ResultCard({ entry }: { entry: Extract<ConsoleEntry, { type: "result" }> }) {
  const kind = guessKind(entry.url, entry.kind);
  return (
    <div className="my-1.5 max-w-sm overflow-hidden rounded-xl border border-white/12 bg-white/[0.03]">
      {kind === "image" && (
        <img src={entry.url} alt={entry.label ?? "Generated image"} className="max-h-56 w-full object-cover" loading="lazy" />
      )}
      {kind === "video" && (
        <video src={entry.url} controls playsInline className="max-h-56 w-full bg-black" />
      )}
      {kind === "audio" && (
        <div className="p-3">
          <audio src={entry.url} controls className="w-full" />
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        {kind === "image" ? (
          <ImageIcon className="size-3.5 shrink-0 text-cyan-300" />
        ) : kind === "video" ? (
          <Film className="size-3.5 shrink-0 text-red-300" />
        ) : kind === "audio" ? (
          <Music className="size-3.5 shrink-0 text-emerald-300" />
        ) : (
          <LinkIcon className="size-3.5 shrink-0 text-white/50" />
        )}
        <span className="truncate text-xs text-white/70">{entry.label ?? "Result"}</span>
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto shrink-0 text-[11px] font-semibold text-cyan-300 no-underline hover:underline"
        >
          Open
        </a>
      </div>
    </div>
  );
}

function ProgressRow({ entry }: { entry: Extract<ConsoleEntry, { type: "progress" }> }) {
  const pct = entry.total > 0 ? Math.min(100, Math.round((entry.current / entry.total) * 100)) : 0;
  return (
    <div className="my-1 max-w-sm">
      <div className="flex items-center justify-between gap-3 text-[11px] text-white/60">
        <span className="truncate">{entry.label ?? "Progress"}</span>
        <span className="shrink-0 font-mono">
          {entry.current}/{entry.total}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-orange-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const LEVEL_CLASS: Record<LogLevel, string> = {
  log: "text-white/85",
  info: "text-cyan-200",
  warn: "text-amber-300",
  error: "text-rose-300",
};

export function ConsolePanel({ entries, running }: { entries: ConsoleEntry[]; running: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length, running]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0918]">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <Terminal className="size-4 text-cyan-300" />
        <span className="text-xs font-semibold uppercase tracking-widest text-white/60">Console</span>
        {running && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300">
            <Loader2 className="size-3 animate-spin" /> Running
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-6">
        {entries.length === 0 && (
          <p className="text-white/35">
            Output appears here. Press <span className="font-semibold text-white/60">Run</span> (or ⌘/Ctrl+Enter) to
            execute your script.
          </p>
        )}
        {entries.map((e) => {
          switch (e.type) {
            case "console":
              return (
                <pre key={e.id} className={`whitespace-pre-wrap break-words ${LEVEL_CLASS[e.level]}`}>
                  {e.text}
                </pre>
              );
            case "api-call":
              return (
                <p key={e.id} className="text-[12px] text-orange-300/80">
                  → {e.path.replace("/api/public/", "")} {e.summary && <span className="text-white/40">({e.summary})</span>}
                </p>
              );
            case "progress":
              return <ProgressRow key={e.id} entry={e} />;
            case "result":
              return <ResultCard key={e.id} entry={e} />;
            case "status":
              return (
                <p
                  key={e.id}
                  className={`mt-1 text-[12px] font-semibold ${
                    e.tone === "ok" ? "text-emerald-300" : e.tone === "error" ? "text-rose-300" : "text-white/60"
                  }`}
                >
                  {e.tone === "error" ? "✕ " : e.tone === "ok" ? "✓ " : ""}
                  {e.text}
                </p>
              );
            default:
              return null;
          }
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
