import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Code2,
  Play,
  Square,
  ArrowRight,
  Loader2,
  Sparkles,
  ChevronDown,
  Eraser,
  ShieldCheck,
  Coins,
  Cpu,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  runInSandbox,
  type SandboxRunner,
  type SandboxEvent,
  type SandboxJobOp,
} from "@/lib/playground/sandbox";
import { TEMPLATES, AURORA_DTS, DEFAULT_TEMPLATE_ID, getTemplate } from "@/lib/playground/templates";
import { ConsolePanel, entryFromEvent, nextEntryId, type ConsoleEntry } from "@/components/playground/ConsolePanel";

const MonacoEditor = lazy(() => import("@/components/playground/CodeEditor"));

export const Route = createLazyFileRoute("/editor")({ component: EditorPage });

function applyEvent(prev: ConsoleEntry[], ev: SandboxEvent): ConsoleEntry[] {
  const entry = entryFromEvent(ev);
  if (!entry) return prev;
  // Collapse consecutive progress updates into a single live bar.
  if (entry.type === "progress" && prev.length > 0 && prev[prev.length - 1].type === "progress") {
    return [...prev.slice(0, -1), entry];
  }
  return [...prev, entry];
}

/**
 * Main-thread executor for aurora.jobs.* — routes each allow-listed op to the
 * existing authed server functions so validation, preview-gating and credit
 * reservation all stay on the standard jobs path.
 */
async function runJobOp(op: SandboxJobOp, body: unknown): Promise<unknown> {
  const { enqueueGenerationJob, listMyJobs, cancelMyJob } = await import("@/lib/jobs.functions");
  switch (op) {
    case "jobs.submit":
      return enqueueGenerationJob({ data: body as never });
    case "jobs.list":
      return listMyJobs();
    case "jobs.cancel":
      return cancelMyJob({ data: body as never });
  }
}

const SPLIT_STORAGE_KEY = "aurora-playground-split";

function loadSplitLayout(): Record<string, number> | undefined {
  try {
    const raw = localStorage.getItem(SPLIT_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, number>;
    }
  } catch {
    /* corrupt or unavailable storage — fall back to defaults */
  }
  return undefined;
}

function saveSplitLayout(layout: Record<string, number>) {
  try {
    localStorage.setItem(SPLIT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* storage unavailable — sizing just won't persist */
  }
}

function EditorPage() {
  const { session, loading } = useAuth();
  const [code, setCode] = useState(() => getTemplate(DEFAULT_TEMPLATE_ID).code);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Read once on mount (client-only) — SSR has no localStorage.
  const [splitLayout] = useState<Record<string, number> | undefined>(() =>
    typeof window === "undefined" ? undefined : loadSplitLayout()
  );
  const runnerRef = useRef<SandboxRunner | null>(null);
  const codeRef = useRef(code);
  codeRef.current = code;

  useEffect(() => setMounted(true), []);
  useEffect(() => () => runnerRef.current?.stop(), []);

  const signedIn = !!session;

  const stop = useCallback(() => {
    runnerRef.current?.stop();
    runnerRef.current = null;
    setRunning(false);
    setEntries((prev) => [
      ...prev,
      { id: nextEntryId(), type: "status", text: "Stopped", tone: "info" },
    ]);
  }, []);

  const run = useCallback(() => {
    if (runnerRef.current) return;
    setEntries([]);
    setRunning(true);
    const runner = runInSandbox({
      code: codeRef.current,
      getToken: async () => {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ?? null;
      },
      runJobOp,
      onEvent: (ev) => {
        setEntries((prev) => applyEvent(prev, ev));
        if (ev.type === "done" || ev.type === "error") {
          runnerRef.current = null;
          setRunning(false);
        }
      },
    });
    runnerRef.current = runner;
  }, []);

  const runRef = useRef(run);
  runRef.current = run;

  const loadTemplate = (id: string) => {
    setTemplateId(id);
    setCode(getTemplate(id).code);
  };

  return (
    <main className="min-h-screen relative overflow-hidden bg-[#070612] text-white pb-28 md:pb-16">
      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute -top-40 -right-40 size-[640px] rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.35), transparent 60%)" }}
      />
      <div
        className="pointer-events-none absolute top-1/2 -left-40 size-[520px] rounded-full blur-3xl opacity-35"
        style={{ background: "radial-gradient(circle, hsl(290 80% 55% / 0.45), transparent 60%)" }}
      />

      <header className="phone-fixed-x fixed top-0 z-40 w-full bg-[#070612]/80 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between pl-24 pr-6 md:px-12 py-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight no-underline">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
            <span className="text-white">Aurora</span>
          </Link>
          <Link
            to="/studio"
            className="inline-flex items-center gap-1.5 rounded-full bg-cyan-300 px-4 py-1.5 text-sm font-bold text-cyan-950 no-underline hover:opacity-95"
          >
            Open Studio <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pt-24 md:px-8 md:pt-28">
        {/* Title row */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-200">
              <Code2 className="size-3.5" /> Playground
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Script the studio{" "}
              <span className="bg-gradient-to-r from-cyan-200 via-white to-orange-200 bg-clip-text text-transparent">
                with code.
              </span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              Write small scripts against the pre-authenticated{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] text-cyan-200">aurora</code>{" "}
              client — batches, pipelines, experiments. Runs are sandboxed in your browser and spend your real Aura.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
              <ShieldCheck className="size-3.5 text-emerald-300" /> Sandboxed in-browser
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
              <Coins className="size-3.5 text-amber-300" /> Spends real Aura
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
              <Cpu className="size-3.5 text-cyan-300" /> Same models as Studio
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {!running ? (
            signedIn ? (
              <button
                type="button"
                onClick={run}
                className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-2 text-sm font-bold text-cyan-950 transition hover:opacity-95"
              >
                <Play className="size-4" /> Run
                <kbd className="ml-1 hidden rounded bg-cyan-950/15 px-1.5 py-0.5 text-[10px] font-semibold sm:inline">
                  ⌘⏎
                </kbd>
              </button>
            ) : (
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-2 text-sm font-bold text-cyan-950 no-underline transition hover:opacity-95"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Sign in to run
              </Link>
            )
          ) : (
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-full bg-rose-400 px-5 py-2 text-sm font-bold text-rose-950 transition hover:opacity-95"
            >
              <Square className="size-4" /> Stop
            </button>
          )}

          <div className="relative">
            <select
              value={templateId}
              onChange={(e) => loadTemplate(e.target.value)}
              aria-label="Load a starter template"
              className="appearance-none rounded-full border border-white/15 bg-white/[0.04] py-2 pl-4 pr-9 text-sm font-semibold text-white outline-none transition hover:bg-white/[0.08] [&>option]:bg-[#0a0918]"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          </div>

          <button
            type="button"
            onClick={() => setEntries([])}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08]"
          >
            <Eraser className="size-3.5" /> Clear console
          </button>

          <p className="ml-auto hidden text-xs text-white/40 lg:block">
            {getTemplate(templateId).description}
          </p>
        </div>

        {/* Editor + console — drag the divider to resize the output panel.
            The group sets inline height:100%, so the wrapper owns the height. */}
        <div className="mt-4 h-[78vh] max-h-[1000px] min-h-[560px]">
          <ResizablePanelGroup
            orientation="vertical"
            defaultLayout={splitLayout}
            onLayoutChanged={saveSplitLayout}
          >
          <ResizablePanel
            id="playground-editor"
            defaultSize="58%"
            minSize="20%"
            className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0918]"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-rose-400/70" />
              <span className="size-2.5 rounded-full bg-amber-300/70" />
              <span className="size-2.5 rounded-full bg-emerald-300/70" />
              <span className="ml-2 text-xs text-white/45">script.js</span>
            </div>
            <div className="min-h-0 flex-1">
              {mounted ? (
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-white/40">
                      <Loader2 className="size-5 animate-spin" />
                    </div>
                  }
                >
                  <MonacoEditor
                    height="100%"
                    language="javascript"
                    theme="vs-dark"
                    value={code}
                    onChange={(v) => setCode(v ?? "")}
                    onMount={(editor, monaco) => {
                      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                        target: monaco.languages.typescript.ScriptTarget.ESNext,
                        allowNonTsExtensions: true,
                        allowJs: true,
                        checkJs: false,
                        lib: ["esnext"],
                      });
                      monaco.languages.typescript.javascriptDefaults.addExtraLib(
                        AURORA_DTS,
                        "ts:aurora.d.ts"
                      );
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                        runRef.current();
                      });
                    }}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      scrollBeyondLastLine: false,
                      padding: { top: 14, bottom: 14 },
                      tabSize: 2,
                      wordWrap: "on",
                      automaticLayout: true,
                      renderLineHighlight: "none",
                      overviewRulerLanes: 0,
                    }}
                  />
                </Suspense>
              ) : (
                <div className="flex h-full items-center justify-center text-white/40">
                  <Loader2 className="size-5 animate-spin" />
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle
            withHandle
            className="my-1.5 h-1.5 rounded-full bg-transparent after:hidden [&>div]:h-3 [&>div]:w-8 [&>div]:rotate-90 [&>div]:rounded-full [&>div]:border-white/15 [&>div]:bg-white/10 [&>div]:text-white/50 hover:[&>div]:bg-white/20"
            aria-label="Resize the console panel"
          />

            <ResizablePanel id="playground-console" defaultSize="42%" minSize="15%" className="min-h-0">
              <ConsolePanel entries={entries} running={running} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* API cheat-sheet */}
        <section className="mt-10">
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-5 text-cyan-200" />
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">
              The <code className="text-cyan-200">aurora</code> client
            </h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { sig: "aurora.image(prompt, opts?)", desc: "Generate a still image. 10 Aura at 720p." },
              { sig: "aurora.video({ prompt, imageUrl?, model? })", desc: "Image-to-video or text-to-video. Runs as a cheap 480p preview first." },
              { sig: "aurora.lipsync({ audioUrl, imageUrl })", desc: "Drive audio onto a face. Model-tiered pricing." },
              { sig: "aurora.text(prompt)", desc: "LLM helper for prompt-writing and planning." },
              { sig: "aurora.generate(options)", desc: "Full-control call — same body as /api/public/generate." },
              { sig: "aurora.jobs.submit(opts) · wait(id) · list() · cancel(id)", desc: "Background render queue — submit now, poll until it finishes, cancel queued jobs." },
              { sig: "aurora.progress(i, total, label?) · aurora.show(url, label?)", desc: "Render progress bars and asset cards in the console." },
            ].map((r) => (
              <div key={r.sig} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <code className="block break-words text-[12.5px] text-cyan-200">{r.sig}</code>
                <p className="mt-1.5 text-sm leading-6 text-white/60">{r.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-white/40">
            Scripts run in an isolated Web Worker in your browser — your session token never enters the sandbox; API
            calls are proxied and authenticated outside it. Every generation spends from the same Aura balance as the
            Studio, and video calls are preview-gated (480p / 5s) until you confirm full quality.
          </p>
        </section>
      </div>
    </main>
  );
}
