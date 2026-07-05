import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  listComfyTemplates,
  getComfyTemplate,
  saveComfyTemplate,
  deleteComfyTemplate,
  adminListComfyRuns,
  comfyReachability,
} from "@/lib/comfy.functions";
import { listWorkers } from "@/lib/workers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminGate, useAdminAutoUnlock } from "@/components/AdminGate";
import { toast } from "sonner";
import {
  Boxes,
  Shield,
  Loader2,
  Trash2,
  Plus,
  Save,
  Server,
  CheckCircle2,
  XCircle,
  Globe,
} from "lucide-react";

export const Route = createFileRoute("/admin/comfy")({
  component: AdminComfyPage,
  head: () => ({
    meta: [
      { title: "ComfyUI admin — Aurora" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const FIELD =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

type EditorState = {
  id?: string;
  name: string;
  description: string;
  kind: "image" | "video";
  workflowText: string;
  inputsText: string;
  defaultsText: string;
  isPublic: boolean;
};

const EMPTY_EDITOR: EditorState = {
  name: "",
  description: "",
  kind: "image",
  workflowText: "",
  inputsText: '[\n  { "key": "6.text", "label": "Prompt", "type": "text", "required": true }\n]',
  defaultsText: "{}",
  isPublic: false,
};

function AdminComfyPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useAdminAutoUnlock(!!user);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const listFn = useServerFn(listComfyTemplates);
  const getFn = useServerFn(getComfyTemplate);
  const saveFn = useServerFn(saveComfyTemplate);
  const delFn = useServerFn(deleteComfyTemplate);
  const runsFn = useServerFn(adminListComfyRuns);
  const workersFn = useServerFn(listWorkers);
  const reachFn = useServerFn(comfyReachability);

  const templatesQ = useQuery({
    queryKey: ["admin-comfy-templates"],
    enabled: !!user && unlocked,
    queryFn: () => listFn({}),
  });
  const runsQ = useQuery({
    queryKey: ["admin-comfy-runs"],
    enabled: !!user && unlocked,
    queryFn: () => runsFn({}),
    refetchInterval: 15_000,
  });
  const workersQ = useQuery({
    queryKey: ["admin-comfy-workers"],
    enabled: !!user && unlocked,
    queryFn: () => workersFn({}),
  });
  const reachQ = useQuery({
    queryKey: ["admin-comfy-reach"],
    enabled: !!user && unlocked,
    queryFn: () => reachFn({}),
  });

  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [saving, setSaving] = useState(false);

  const comfyWorkers = useMemo(
    () =>
      (workersQ.data?.workers ?? []).filter(
        (w: Record<string, unknown>) => w.protocol === "comfyui",
      ),
    [workersQ.data],
  );

  const loadForEdit = async (id: string) => {
    try {
      const r = await getFn({ data: { id } });
      const t = r.template as Record<string, unknown>;
      setEditor({
        id: t.id as string,
        name: (t.name as string) ?? "",
        description: (t.description as string) ?? "",
        kind: t.kind === "video" ? "video" : "image",
        workflowText: JSON.stringify(t.workflow_json ?? {}, null, 2),
        inputsText: JSON.stringify(t.declared_inputs ?? [], null, 2),
        defaultsText: JSON.stringify(t.default_inputs ?? {}, null, 2),
        isPublic: !!t.is_public,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    }
  };

  const save = async () => {
    let workflowJson: unknown;
    let declaredInputs: unknown;
    let defaultInputs: unknown;
    try {
      workflowJson = JSON.parse(editor.workflowText);
    } catch {
      return toast.error("Workflow JSON is invalid");
    }
    try {
      declaredInputs = editor.inputsText.trim() ? JSON.parse(editor.inputsText) : [];
    } catch {
      return toast.error("Declared inputs JSON is invalid");
    }
    try {
      defaultInputs = editor.defaultsText.trim() ? JSON.parse(editor.defaultsText) : {};
    } catch {
      return toast.error("Default inputs JSON is invalid");
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          id: editor.id,
          name: editor.name,
          description: editor.description || null,
          kind: editor.kind,
          workflowJson,
          declaredInputs: declaredInputs as Record<string, unknown>[],
          defaultInputs: defaultInputs as Record<string, unknown>,
          isPublic: editor.isPublic,
        },
      });
      toast.success(editor.id ? "Template updated" : "Template created");
      setEditor(EMPTY_EDITOR);
      templatesQ.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await delFn({ data: { id } });
      if (editor.id === id) setEditor(EMPTY_EDITOR);
      templatesQ.refetch();
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;

  const templates = (templatesQ.data?.templates ?? []) as Array<Record<string, unknown>>;
  const runs = (runsQ.data?.runs ?? []) as Array<Record<string, unknown>>;
  const reach = reachQ.data;

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/admin" className="flex items-center gap-2 font-semibold tracking-tight no-underline text-foreground">
          <Boxes className="size-5 text-primary" /> ComfyUI admin
          <span className="ml-2 text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center gap-1">
            <Shield className="size-3" /> Admin
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/admin" className="text-muted-foreground hover:text-foreground">
            Overview
          </Link>
          <Link to="/comfy" className="text-muted-foreground hover:text-foreground">
            Run page
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
        {/* Worker + reachability status */}
        <section className="grid sm:grid-cols-3 gap-4">
          <StatusCard
            icon={Server}
            label="ComfyUI workers"
            value={`${comfyWorkers.length}`}
            sub={
              reach
                ? reach.serverHasWorker
                  ? `${reach.workerCount} active for runs`
                  : "none active — runs will fail fast"
                : "…"
            }
            ok={!!reach?.serverHasWorker}
          />
          <StatusCard
            icon={Globe}
            label="Embedded editor"
            value={reach?.editorAllowed ? "Available" : "Off"}
            sub={reach?.editorAllowed ? "COMFYUI_EDITOR_URL set" : "set COMFYUI_EDITOR_URL to embed"}
            ok={!!reach?.editorAllowed}
          />
          <StatusCard
            icon={Boxes}
            label="Templates"
            value={`${templates.length}`}
            sub="public + your own"
            ok={templates.length > 0}
          />
        </section>

        {/* Editor */}
        <section className="rounded-2xl border border-border bg-card/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              {editor.id ? "Edit template" : "New template"}
            </h2>
            {editor.id && (
              <Button variant="ghost" size="sm" onClick={() => setEditor(EMPTY_EDITOR)}>
                New instead
              </Button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Name</label>
              <Input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Output kind</label>
              <select
                className={FIELD}
                value={editor.kind}
                onChange={(e) => setEditor({ ...editor, kind: e.target.value as "image" | "video" })}
              >
                <option value="image">image</option>
                <option value="video">video</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <Input
              value={editor.description}
              onChange={(e) => setEditor({ ...editor, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Workflow JSON (ComfyUI /prompt API graph)</label>
            <textarea
              className={`${FIELD} font-mono text-xs`}
              rows={10}
              value={editor.workflowText}
              onChange={(e) => setEditor({ ...editor, workflowText: e.target.value })}
              placeholder='{ "3": { "class_type": "KSampler", "inputs": { ... } } }'
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Declared inputs (array)</label>
              <textarea
                className={`${FIELD} font-mono text-xs`}
                rows={8}
                value={editor.inputsText}
                onChange={(e) => setEditor({ ...editor, inputsText: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Default inputs (object)</label>
              <textarea
                className={`${FIELD} font-mono text-xs`}
                rows={8}
                value={editor.defaultsText}
                onChange={(e) => setEditor({ ...editor, defaultsText: e.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editor.isPublic}
                onChange={(e) => setEditor({ ...editor, isPublic: e.target.checked })}
              />
              Publish to all users (admin only)
            </label>
            <Button onClick={save} disabled={saving || !editor.name.trim() || !editor.workflowText.trim()}>
              {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
              {editor.id ? "Update" : "Create"} template
            </Button>
          </div>
        </section>

        {/* Template list */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Templates</h2>
          {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            {templates.map((t) => (
              <div key={t.id as string} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{t.name as string}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.kind as string}
                      {t.is_public ? " · public" : t.mine ? " · yours" : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => loadForEdit(t.id as string)}>
                      Edit
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(t.id as string, t.name as string)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {t.description != null && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{t.description as string}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Recent runs */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Recent runs (all users)</h2>
          {runs.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
          <div className="space-y-2">
            {runs.map((r) => (
              <div
                key={r.id as string}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                {r.status === "succeeded" ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : r.status === "failed" ? (
                  <XCircle className="size-4 text-red-500" />
                ) : (
                  <Loader2 className="size-4 animate-spin text-amber-500" />
                )}
                <span className="text-muted-foreground">{new Date(r.created_at as string).toLocaleString()}</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{r.source as string}</span>
                <span className="ml-auto text-xs">{r.status as string}</span>
                {(r.error as string) && (
                  <span className="text-xs text-red-400 truncate max-w-[280px]" title={r.error as string}>
                    {r.error as string}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  sub,
  ok,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  sub: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
        <Icon className="size-4" /> {label}
      </div>
      <p className="text-2xl font-semibold mt-2 flex items-center gap-2">
        {value}
        <span className={`size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
      </p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
