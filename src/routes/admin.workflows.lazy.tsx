import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  adminDeleteGuidedWorkflow,
  adminListGuidedWorkflows,
  adminSaveGuidedWorkflow,
  adminSeedGuidedWorkflows,
} from "@/lib/guided-workflows.functions";
import {
  CATEGORY_LABELS,
  guidedWorkflowContentSchema,
  type GuidedWorkflowContent,
  type GuidedWorkflowRow,
} from "@/lib/guided-workflows.schema";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Shield,
  Loader2,
  ArrowLeft,
  BookOpen,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";

export const Route = createLazyFileRoute("/admin/workflows")({
  component: AdminWorkflowsPage,
});

const NEW_WORKFLOW_TEMPLATE: GuidedWorkflowContent = {
  slug: "my-new-guide",
  title: "My New Guide",
  tagline: "One-line pitch shown on the card",
  description: "What this playbook produces and who it's for.",
  category: "performance",
  icon: "🎬",
  sourceCredit: "",
  isPublished: false,
  sortOrder: 100,
  steps: [
    {
      id: "step-1",
      title: "First step",
      kind: "image",
      description: "Explain what the user does here.",
      promptTemplate: "A cinematic still of [SUBJECT] ...",
      placeholders: [{ key: "SUBJECT", label: "Subject", example: "a soul singer in a red suit" }],
      referenceSlots: [],
      usesPreviousResult: false,
      tips: [],
      toolLink: null,
      variants: [],
    },
  ],
};

function AdminWorkflowsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<GuidedWorkflowRow | "new" | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const listFn = useServerFn(adminListGuidedWorkflows);
  const saveFn = useServerFn(adminSaveGuidedWorkflow);
  const deleteFn = useServerFn(adminDeleteGuidedWorkflow);
  const seedFn = useServerFn(adminSeedGuidedWorkflows);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-guided-workflows"],
    queryFn: () => listFn(),
    enabled: !!user,
  });
  const workflows = useMemo(() => data?.workflows ?? [], [data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-guided-workflows"] });
    qc.invalidateQueries({ queryKey: ["guided-workflows"] });
  };

  const saveMut = useMutation({
    mutationFn: (vars: { id?: string | null; content: GuidedWorkflowContent }) =>
      saveFn({ data: vars }),
    onSuccess: () => {
      toast.success("Workflow saved");
      setEditing(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Workflow deleted");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const seedMut = useMutation({
    mutationFn: () => seedFn(),
    onSuccess: (res) => {
      toast.success(`Seeded ${res.upserted} curated guides`);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Seed failed"),
  });

  const openEditor = (target: GuidedWorkflowRow | "new") => {
    setEditing(target);
    const content: GuidedWorkflowContent =
      target === "new"
        ? NEW_WORKFLOW_TEMPLATE
        : {
            slug: target.slug,
            title: target.title,
            tagline: target.tagline,
            description: target.description,
            category: target.category,
            icon: target.icon,
            sourceCredit: target.sourceCredit,
            steps: target.steps,
            isPublished: target.isPublished,
            sortOrder: target.sortOrder,
          };
    setDraft(JSON.stringify(content, null, 2));
  };

  const submitDraft = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch (e) {
      toast.error(`Invalid JSON: ${e instanceof Error ? e.message : "parse error"}`);
      return;
    }
    const check = guidedWorkflowContentSchema.safeParse(parsed);
    if (!check.success) {
      const first = check.error.issues[0];
      toast.error(`${first.path.join(".")}: ${first.message}`);
      return;
    }
    saveMut.mutate({
      id: editing !== "new" && editing ? editing.id : null,
      content: check.data,
    });
  };

  const togglePublish = (w: GuidedWorkflowRow) => {
    saveMut.mutate({
      id: w.id,
      content: {
        slug: w.slug,
        title: w.title,
        tagline: w.tagline,
        description: w.description,
        category: w.category,
        icon: w.icon,
        sourceCredit: w.sourceCredit,
        steps: w.steps,
        isPublished: !w.isPublished,
        sortOrder: w.sortOrder,
      },
    });
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between pl-5 pr-5 py-5 border-b border-border bg-card/40 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20"><span className="inline-block size-2.5 rounded-full bg-primary" /></span>
            Aurora Admin
            <span className="ml-2 text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center gap-1">
              <Shield className="size-3" /> Admin
            </span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <BookOpen className="size-4" /> Guided Workflows
          </span>
        </div>
        <Link to="/admin" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to Admin
        </Link>
      </header>

      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <BookOpen className="size-6 text-primary" /> Guided Workflows
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              The step-by-step viral playbooks users see at /guides. Only published guides are visible.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => seedMut.mutate()}
              disabled={seedMut.isPending}
              className="gap-2"
            >
              {seedMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Seed curated guides
            </Button>
            <Button onClick={() => openEditor("new")} className="gap-2">
              <Plus className="size-4" /> New workflow
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
            No workflows yet — hit "Seed curated guides" to load the built-in playbooks.
          </div>
        ) : (
          <div className="grid gap-3">
            {workflows.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card/40 p-4"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background/60 text-lg">
                  {w.icon || "🎬"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{w.title}</span>
                    <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {CATEGORY_LABELS[w.category]}
                    </span>
                    <span
                      className={
                        w.isPublished
                          ? "rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                          : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      }
                    >
                      {w.isPublished ? "Published" : "Draft"}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    /guides/{w.slug} · {w.steps.length} steps · sort {w.sortOrder}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => togglePublish(w)}
                    disabled={saveMut.isPending}
                    className="gap-1.5"
                  >
                    {w.isPublished ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {w.isPublished ? "Unpublish" : "Publish"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openEditor(w)} className="gap-1.5">
                    <Pencil className="size-3.5" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Delete "${w.title}"? This can't be undone.`)) {
                        deleteMut.mutate(w.id);
                      }
                    }}
                    disabled={deleteMut.isPending}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* JSON editor drawer */}
      {editing !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <div className="text-sm font-semibold">
                {editing === "new" ? "New workflow" : `Edit: ${editing.title}`}
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
                aria-label="Close editor"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                className="h-[55vh] w-full resize-none rounded-xl border border-border bg-card/40 p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary/60"
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Full workflow JSON — validated against the shared schema before saving.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={submitDraft} disabled={saveMut.isPending} className="gap-2">
                {saveMut.isPending && <Loader2 className="size-4 animate-spin" />}
                Save workflow
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
