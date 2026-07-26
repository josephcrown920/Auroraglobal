import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listComfyTemplates,
  saveComfyTemplate,
  deleteComfyTemplate,
  startComfyRun,
  getComfyRun,
  listComfyRuns,
  comfyReachability,
} from "@/lib/comfy.functions";
import { pollComfyRunUntilDone } from "@/lib/use-job-polling";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";
import { toast } from "sonner";
import {
  Boxes,
  Play,
  Plus,
  Trash2,
  Loader2,
  ImageIcon,
  Video,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  Globe,
  Server,
} from "lucide-react";

type DeclaredInput = {
  key: string;
  label: string;
  type: "text" | "image" | "number" | "seed" | "select" | "boolean";
  required?: boolean;
  options?: string[];
  default?: unknown;
  min?: number;
  max?: number;
  placeholder?: string;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  kind: "image" | "video";
  declared_inputs: DeclaredInput[];
  default_inputs: Record<string, unknown>;
  is_public: boolean;
  created_by_admin: boolean;
  mine: boolean;
};

type RunRow = {
  id: string;
  workflow_id: string | null;
  status: string;
  progress_pct: number;
  output_url: string | null;
  output_kind: string | null;
  error: string | null;
  source: string;
  created_at: string;
};

type ComfyReach = {
  serverHasWorker: boolean;
  workerCount: number;
  editorAllowed: boolean;
  editorUrl: string | null;
};

export const Route = createLazyFileRoute("/comfy")({ component: ComfyPage });

const FIELD_CLASS =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

function ComfyPage() {
  const { user, loading } = useAuth();
  const list = useServerFn(listComfyTemplates);
  const save = useServerFn(saveComfyTemplate);
  const del = useServerFn(deleteComfyTemplate);
  const run = useServerFn(startComfyRun);
  const getRunFn = useServerFn(getComfyRun);
  const runsFn = useServerFn(listComfyRuns);
  const reachFn = useServerFn(comfyReachability);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; url?: string; outputKind?: string; creditsCost?: number }
    | { ok: false; error: string }
    | null
  >(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [reach, setReach] = useState<ComfyReach | null>(null);
  const [progress, setProgress] = useState(0);

  const selected = useMemo(() => templates.find((t) => t.id === selectedId) ?? null, [templates, selectedId]);

  const refreshTemplates = () =>
    list({})
      .then((r) => setTemplates(r.templates as unknown as Template[]))
      .catch(() => {});
  const refreshRuns = () =>
    runsFn({})
      .then((r) => setRuns(r.runs as unknown as RunRow[]))
      .catch(() => {});

  useEffect(() => {
    if (user) {
      refreshTemplates();
      refreshRuns();
      reachFn({})
        .then((r) => setReach(r))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setReach is a stable useState setter; dep narrowed to user identity to avoid redundant re-fetches
  }, [user]);

  // Coarse, estimated progress while a synchronous run is in flight. Authoritative
  // server status is reflected in Recent runs (and the run row in the DB).
  useEffect(() => {
    if (!running) {
      setProgress(0);
      return;
    }
    setProgress(8);
    const iv = setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 12)) : p));
    }, 700);
    return () => clearInterval(iv);
  }, [running]);

  // When a template is selected, seed field values from its defaults.
  useEffect(() => {
    if (!selected) return;
    const seed: Record<string, unknown> = {};
    for (const d of selected.declared_inputs ?? []) {
      if (d.default !== undefined) seed[d.key] = d.default;
    }
    for (const [k, v] of Object.entries(selected.default_inputs ?? {})) seed[k] = v;
    setValues(seed);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setValues/setResult are stable useState setters; dep narrowed to selectedId to seed form only when the template changes
  }, [selectedId]);

  const setVal = (key: string, v: unknown) => setValues((prev) => ({ ...prev, [key]: v }));

  const doRun = async () => {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    try {
      const r = (await run({ data: { workflowId: selected.id, values, source: "run" } })) as
        | { ok: true; run: { id: string }; creditsCost?: number }
        | { ok: false; error: string };
      if (!r.ok) {
        setResult(r);
        toast.error(r.error);
        refreshRuns();
        return;
      }
      // Enqueue-only server fn: the render runs in the background (survives
      // closing the tab) — poll the run row until it goes terminal.
      refreshRuns();
      const done = await pollComfyRunUntilDone(getRunFn, r.run.id);
      setResult({
        ok: true,
        url: done.output_url ?? undefined,
        outputKind: done.output_kind ?? undefined,
        creditsCost: r.creditsCost,
      });
      toast.success("Run complete");
      refreshRuns();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Run failed";
      setResult({ ok: false, error: msg });
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold text-foreground no-underline">
          Aurora
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/studio" className="text-foreground/70 no-underline">
            Studio
          </Link>
          <Link to="/canvas" className="text-foreground/70 no-underline">
            Canvas
          </Link>
          <Link to="/workflows" className="text-foreground/70 no-underline">
            Workflows
          </Link>
          <Link to="/gallery" className="text-foreground/70 no-underline">
            Gallery
          </Link>
        </nav>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Boxes className="h-7 w-7 text-primary" /> ComfyUI
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Run saved ComfyUI graphs on your registered GPU workers. Declared inputs, your credits, live results.
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowNew((s) => !s)}>
            <Plus className="h-4 w-4 mr-1" /> New workflow
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : !user ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Please{" "}
              <Link to="/auth" className="text-primary">
                sign in
              </Link>{" "}
              to save and run ComfyUI workflows.
            </p>
          </div>
        ) : (
          <>
            {showNew && <NewTemplateForm onSave={save} onDone={() => { setShowNew(false); refreshTemplates(); }} />}

            <div className="grid lg:grid-cols-[300px_1fr] gap-6">
              {/* Template list */}
              <aside className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">
                  Workflows
                </h2>
                {templates.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No workflows yet. Click <span className="text-foreground">New workflow</span> to add one.
                  </p>
                )}
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      selectedId === t.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {t.kind === "video" ? (
                        <Video className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-medium text-sm truncate">{t.name}</span>
                      {t.is_public && (
                        <span className="ml-auto text-[10px] uppercase tracking-wide text-primary/80">public</span>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                    )}
                  </button>
                ))}
              </aside>

              {/* Run panel */}
              <div>
                {!selected ? (
                  <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
                    Select a workflow to configure and run it.
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{selected.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {selected.kind} · {selected.declared_inputs?.length ?? 0} input
                          {(selected.declared_inputs?.length ?? 0) === 1 ? "" : "s"}
                        </p>
                      </div>
                      {selected.mine && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm(`Delete "${selected.name}"?`)) return;
                            await del({ data: { id: selected.id } });
                            setSelectedId(null);
                            refreshTemplates();
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-4">
                      {(selected.declared_inputs ?? []).map((d) => (
                        <Field key={d.key} input={d} value={values[d.key]} onChange={(v) => setVal(d.key, v)} />
                      ))}
                      {(selected.declared_inputs?.length ?? 0) === 0 && (
                        <p className="text-sm text-muted-foreground">
                          This workflow has no declared inputs — it runs the graph as-is.
                        </p>
                      )}
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                      <Button onClick={doRun} disabled={running}>
                        {running ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Running…
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-1" /> Run
                          </>
                        )}
                      </Button>
                      {running && (
                        <span className="text-xs text-muted-foreground">
                          Submitting to your GPU worker and polling for the result…
                        </span>
                      )}
                    </div>

                    {running && (
                      <div className="mt-4">
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand to-orange-400 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          Estimated progress · {progress}% — authoritative status appears in Recent runs
                        </p>
                      </div>
                    )}

                    {/* Result */}
                    {result && (
                      <div className="mt-6 border-t border-border pt-5">
                        {result.ok ? (
                          <div>
                            <p className="text-sm font-medium text-emerald-500 mb-3">Output</p>
                            {result.outputKind === "video" ? (
                              <video src={result.url} controls className="max-h-[420px] rounded-lg border border-border" />
                            ) : (
                              <img
                                src={result.url}
                                alt="ComfyUI output"
                                className="max-h-[420px] rounded-lg border border-border"
                              />
                            )}
                            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary inline-flex items-center gap-1"
                              >
                                Open <ExternalLink className="h-3 w-3" />
                              </a>
                              {typeof result.creditsCost === "number" && <span>· {result.creditsCost} credits</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                            <span className="text-foreground/80">{result.error}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Recent runs */}
                {runs.length > 0 && (
                  <div className="mt-8">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3">
                      Recent runs
                    </h2>
                    <div className="space-y-2">
                      {runs.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                        >
                          <StatusDot status={r.status} />
                          <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                          <span className="ml-auto text-xs uppercase tracking-wide text-muted-foreground">
                            {r.status}
                          </span>
                          {r.output_url && (
                            <a
                              href={r.output_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary inline-flex items-center gap-1 text-xs"
                            >
                              View <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <ComfyEditorPanel reach={reach} />
          </>
        )}
      </section>
      <SiteFooter tone="light" />
    </main>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "succeeded"
      ? "bg-emerald-500"
      : status === "failed"
        ? "bg-red-500"
        : status === "running"
          ? "bg-amber-500 animate-pulse"
          : "bg-muted-foreground";
  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}

function ComfyEditorPanel({ reach }: { reach: ComfyReach | null }) {
  if (!reach) return null;
  return (
    <section className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3 flex items-center gap-2">
        <Globe className="h-3.5 w-3.5" /> ComfyUI editor
      </h2>
      {reach.editorAllowed && reach.editorUrl ? (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-emerald-500" />
              Embedded editor · {reach.workerCount} worker{reach.workerCount === 1 ? "" : "s"} active
            </span>
            <a
              href={reach.editorUrl}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1"
            >
              Open in new tab <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <iframe
            src={reach.editorUrl}
            title="ComfyUI editor"
            className="w-full h-[600px] bg-background"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">The visual editor isn&apos;t embeddable here.</p>
              <p className="text-muted-foreground">
                Your GPU worker&apos;s ComfyUI server isn&apos;t reachable from the browser (it&apos;s a private endpoint, by
                design). To embed the node editor, an operator can set{" "}
                <code className="text-foreground">COMFYUI_EDITOR_URL</code> to a deliberately-public, HTTPS ComfyUI URL.
              </p>
              <p className="text-muted-foreground inline-flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5" />
                {reach.serverHasWorker
                  ? `${reach.workerCount} ComfyUI worker${reach.workerCount === 1 ? "" : "s"} active — runs work from the panel above.`
                  : "No active ComfyUI worker — runs will fail fast until one is registered in admin."}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({
  input,
  value,
  onChange,
}: {
  input: DeclaredInput;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <label className="block text-sm font-medium mb-1.5">
      {input.label}
      {input.required && <span className="text-red-500"> *</span>}
    </label>
  );
  switch (input.type) {
    case "text":
      return (
        <div>
          {label}
          <textarea
            className={FIELD_CLASS}
            rows={3}
            placeholder={input.placeholder}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "image":
      return (
        <div>
          {label}
          <input
            className={FIELD_CLASS}
            type="url"
            placeholder={input.placeholder ?? "https://…"}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
    case "number":
    case "seed":
      return (
        <div>
          {label}
          <input
            className={FIELD_CLASS}
            type="number"
            min={input.min}
            max={input.max}
            step={input.type === "seed" ? 1 : "any"}
            value={value === undefined || value === null ? "" : (value as number)}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </div>
      );
    case "select":
      return (
        <div>
          {label}
          <select className={FIELD_CLASS} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
            <option value="">Select…</option>
            {(input.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          {input.label}
        </label>
      );
    default:
      return null;
  }
}

function NewTemplateForm({
  onSave,
  onDone,
}: {
  onSave: ReturnType<typeof useServerFn<typeof saveComfyTemplate>>;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"image" | "video">("image");
  const [workflowText, setWorkflowText] = useState("");
  const [inputsText, setInputsText] = useState(
    '[\n  { "key": "6.text", "label": "Prompt", "type": "text", "required": true }\n]',
  );
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    let workflowJson: unknown;
    let declaredInputs: unknown;
    try {
      workflowJson = JSON.parse(workflowText);
    } catch {
      toast.error("Workflow JSON is not valid JSON");
      return;
    }
    try {
      declaredInputs = inputsText.trim() ? JSON.parse(inputsText) : [];
    } catch {
      toast.error("Declared inputs is not valid JSON");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        data: {
          name,
          description: description || null,
          kind,
          workflowJson,
          declaredInputs: declaredInputs as Record<string, unknown>[],
          defaultInputs: {},
          isPublic: false,
        },
      });
      toast.success("Workflow saved");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <ChevronDown className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">New ComfyUI workflow</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Name</label>
          <input className={FIELD_CLASS} value={name} onChange={(e) => setName(e.target.value)} placeholder="My SDXL graph" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Output kind</label>
          <select className={FIELD_CLASS} value={kind} onChange={(e) => setKind(e.target.value as "image" | "video")}>
            <option value="image">image</option>
            <option value="video">video</option>
          </select>
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1.5">Description</label>
        <input
          className={FIELD_CLASS}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this workflow does"
        />
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1.5">
          Workflow JSON <span className="text-muted-foreground font-normal">(the ComfyUI /prompt graph, API format)</span>
        </label>
        <textarea
          className={`${FIELD_CLASS} text-xs`}
          rows={8}
          value={workflowText}
          onChange={(e) => setWorkflowText(e.target.value)}
          placeholder='{ "3": { "class_type": "KSampler", "inputs": { ... } }, ... }'
        />
      </div>
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1.5">
          Declared inputs{" "}
          <span className="text-muted-foreground font-normal">
            (array of {"{ key: \"nodeId.inputName\", label, type }"})
          </span>
        </label>
        <textarea
          className={`${FIELD_CLASS} text-xs`}
          rows={6}
          value={inputsText}
          onChange={(e) => setInputsText(e.target.value)}
        />
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Button onClick={submit} disabled={saving || !name.trim() || !workflowText.trim()}>
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Save workflow
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
