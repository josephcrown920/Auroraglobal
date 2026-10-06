import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FeatureGuard } from "@/components/FeatureVisibilityProvider";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  listMyMarketplaceTemplates,
  submitMarketplaceTemplate,
  updateMyMarketplaceTemplate,
  getCreatorEarnings,
  type MarketplaceTemplate,
} from "@/lib/marketplace.functions";
import type { Node, Edge } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Store,
  ArrowLeft,
  Plus,
  Coins,
  TrendingUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  PenLine,
  Upload,
  Sparkles,
  Eye,
} from "lucide-react";

// Artist-only mode: this feature is hidden from regular users by default.
// Admins always pass; regular users are redirected to /studio unless the
// owner has toggled the feature visible (see feature-visibility registry).
export const Route = createLazyFileRoute("/creator/dashboard")({
  component: () => (
    <FeatureGuard feature="creator-hub">
      <CreatorDashboardPage />
    </FeatureGuard>
  ),
});

const STATUS_CHIP: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  draft:    { label: "Draft",    icon: PenLine,      className: "bg-muted text-muted-foreground" },
  pending:  { label: "Pending",  icon: Clock,        className: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  approved: { label: "Live",     icon: CheckCircle2, className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  rejected: { label: "Rejected", icon: XCircle,      className: "bg-red-500/15 text-red-400 border border-red-500/30" },
};

const CATEGORIES = ["Portrait & Colors", "Music & Lip-sync", "Cinema", "Product & App", "Other"];

type FormState = {
  name: string;
  description: string;
  thumbnail_url: string;
  category: string;
  tags: string;
  run_cost_aura: number;
  graph_json: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  thumbnail_url: "",
  category: "Other",
  tags: "",
  run_cost_aura: 50,
  graph_json: '{"name":"My Template","nodes":[],"edges":[]}',
};

function CreatorDashboardPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"templates" | "earnings">("templates");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const listFn = useServerFn(listMyMarketplaceTemplates);
  const submitFn = useServerFn(submitMarketplaceTemplate);
  const updateFn = useServerFn(updateMyMarketplaceTemplate);
  const earningsFn = useServerFn(getCreatorEarnings);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["my-marketplace-templates"],
    queryFn: () => listFn(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const { data: earnings } = useQuery({
    queryKey: ["creator-earnings"],
    queryFn: () => earningsFn(),
    enabled: !!user && tab === "earnings",
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      let graph: Record<string, unknown>;
      try {
        graph = JSON.parse(form.graph_json);
      } catch {
        throw new Error("Invalid graph JSON");
      }
      const tags = form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (editingId) {
        return updateFn({
          data: {
            id: editingId,
            name: form.name,
            description: form.description,
            thumbnail_url: form.thumbnail_url || null,
            graph_json: graph,
            category: form.category,
            tags,
            run_cost_aura: form.run_cost_aura,
            resubmit: true,
          },
        });
      }
      return submitFn({
        data: {
          name: form.name,
          description: form.description,
          thumbnail_url: form.thumbnail_url || null,
          graph_json: graph,
          category: form.category,
          tags,
          run_cost_aura: form.run_cost_aura,
        },
      });
    },
    onSuccess: () => {
      toast.success(editingId ? "Template updated and resubmitted" : "Template submitted for review!");
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["my-marketplace-templates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Submission failed"),
  });

  const openEdit = (t: MarketplaceTemplate) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      description: t.description,
      thumbnail_url: t.thumbnail_url ?? "",
      category: t.category,
      tags: t.tags.join(", "),
      run_cost_aura: t.run_cost_aura,
      graph_json: JSON.stringify(t.graph_json, null, 2),
    });
    setShowForm(true);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const approvedCount = templates.filter((t) => t.status === "approved").length;
  const totalRuns = templates.reduce((s, t) => s + t.run_count, 0);

  return (
    <main className="aurora-page-shell text-foreground">
      <span aria-hidden className="aurora-ambient" />

      <header className="relative z-10 flex items-center justify-between border-b border-border bg-background/80 pl-24 pr-5 py-4 backdrop-blur-xl">
        <Link
          to="/marketplace"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground no-underline"
        >
          <ArrowLeft className="size-4" /> Marketplace
        </Link>
        <Link
          to="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground no-underline"
        >
          My dashboard
        </Link>
      </header>

      <section className="relative z-10 px-5 pb-24 pt-6 max-w-3xl mx-auto w-full">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
              <Store className="size-3.5" /> Creator Hub
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Creator Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit templates, track approvals, and monitor your earnings.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditingId(null);
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
            className="gap-1.5"
          >
            <Plus className="size-4" /> Submit template
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard icon={Store} label="Templates" value={templates.length} />
          <StatCard icon={CheckCircle2} label="Live" value={approvedCount} />
          <StatCard icon={TrendingUp} label="Total runs" value={totalRuns} />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border mb-5">
          {(["templates", "earnings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
                tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Templates tab */}
        {tab === "templates" && (
          <div className="space-y-3">
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            )}
            {!isLoading && templates.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card/20 p-10 text-center space-y-3">
                <Store className="size-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">You haven't submitted any templates yet.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); }}
                >
                  <Plus className="size-3.5" /> Submit your first template
                </Button>
              </div>
            )}
            {templates.map((t) => {
              const chip = STATUS_CHIP[t.status] ?? STATUS_CHIP.draft;
              const ChipIcon = chip.icon;
              const canEdit = t.status === "draft" || t.status === "rejected";
              return (
                <div
                  key={t.id}
                  className="rounded-2xl border border-border bg-card/30 p-4 flex gap-4"
                >
                  {t.thumbnail_url ? (
                    <img src={t.thumbnail_url} alt={t.name} className="w-16 h-16 rounded-xl object-cover shrink-0 border border-border" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Store className="size-6 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{t.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${chip.className}`}>
                        <ChipIcon className="size-2.5" /> {chip.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Coins className="size-3 text-primary" /> {t.run_cost_aura} Aura
                      </span>
                      <span>{t.run_count} runs</span>
                      <span>~{((t.run_count * t.run_cost_aura * t.cut_pct) / 100).toFixed(1)} Aura earned</span>
                    </div>
                    {t.rejection_reason && (
                      <p className="mt-1 text-xs text-red-400">Rejected: {t.rejection_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                    >
                      <Eye className="size-3.5" /> Preview
                    </Button>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => openEdit(t)}
                      >
                        <PenLine className="size-3.5" /> Edit
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Earnings tab */}
        {tab === "earnings" && (
          <div className="space-y-4">
            {!earnings ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                <Loader2 className="size-4 animate-spin" /> Loading earnings…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={TrendingUp} label="Total runs" value={earnings.totalRuns} />
                  <StatCard icon={Coins} label="Earned (Aura)" value={Number(earnings.totalEarnedAura).toFixed(2)} />
                </div>
                <p className="text-xs text-muted-foreground px-1">
                  Aura earnings are tracked here. Payouts to your bank account will be available in a future update.
                </p>

                <div>
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Per-template breakdown
                  </h3>
                  {earnings.templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No templates yet.</p>
                  ) : (
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="text-left p-3">Template</th>
                            <th className="text-right p-3">Status</th>
                            <th className="text-right p-3">Runs</th>
                            <th className="text-right p-3">Cost</th>
                            <th className="text-right p-3">Your cut</th>
                            <th className="text-right p-3">Earned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {earnings.templates.map((t) => {
                            const chip = STATUS_CHIP[t.status] ?? STATUS_CHIP.draft;
                            const ChipIcon = chip.icon;
                            const earned = (t.run_count * t.run_cost_aura * Number(t.cut_pct)) / 100;
                            return (
                              <tr key={t.id} className="border-t border-border hover:bg-card/40">
                                <td className="p-3 font-medium text-xs">{t.name}</td>
                                <td className="p-3 text-right">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${chip.className}`}>
                                    <ChipIcon className="size-2.5" /> {chip.label}
                                  </span>
                                </td>
                                <td className="p-3 text-right">{t.run_count}</td>
                                <td className="p-3 text-right">{t.run_cost_aura}</td>
                                <td className="p-3 text-right">{Number(t.cut_pct)}%</td>
                                <td className="p-3 text-right text-emerald-400 font-medium">{earned.toFixed(1)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {earnings.recentRuns.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">
                      Recent runs
                    </h3>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="text-left p-3">When</th>
                            <th className="text-right p-3">Charged</th>
                            <th className="text-right p-3">Your cut</th>
                          </tr>
                        </thead>
                        <tbody>
                          {earnings.recentRuns.map((r, i) => (
                            <tr key={i} className="border-t border-border hover:bg-card/40">
                              <td className="p-3 text-xs text-muted-foreground">
                                {new Date(r.created_at).toLocaleString()}
                              </td>
                              <td className="p-3 text-right">{r.aura_charged} Aura</td>
                              <td className="p-3 text-right text-emerald-400">
                                {Number(r.creator_cut_aura).toFixed(2)} Aura
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* Graph preview */}
      {previewId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full space-y-3 shadow-2xl max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Graph JSON</h2>
              <Button variant="ghost" size="sm" onClick={() => setPreviewId(null)}>Close</Button>
            </div>
            <pre className="text-xs bg-muted/50 rounded-xl p-4 overflow-auto max-h-[50vh] leading-relaxed">
              {JSON.stringify(templates.find((t) => t.id === previewId)?.graph_json, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Submit / Edit form */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitMut.isPending) {
              setShowForm(false);
            }
          }}
        >
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Upload className="size-5 text-primary" />
                {editingId ? "Edit & resubmit" : "Submit a template"}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                disabled={submitMut.isPending}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-3">
              <Field label="Template name *">
                <Input
                  placeholder="e.g. Neon Portrait Pack"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>

              <Field label="Description">
                <textarea
                  placeholder="What does this template do? What kind of input does it need?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Aura cost per run">
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={form.run_cost_aura}
                    onChange={(e) =>
                      setForm({ ...form, run_cost_aura: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                  />
                </Field>
              </div>

              <Field label="Tags (comma-separated)">
                <Input
                  placeholder="Selfie, Portrait, Video, Preset"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                />
              </Field>

              <Field label="Thumbnail URL (optional)">
                <Input
                  placeholder="https://…"
                  value={form.thumbnail_url}
                  onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
                />
              </Field>

              <Field label="Graph JSON *">
                <textarea
                  placeholder='{"name":"My Template","nodes":[…],"edges":[…]}'
                  value={form.graph_json}
                  onChange={(e) => {
                    setForm({ ...form, graph_json: e.target.value });
                    try { JSON.parse(e.target.value); setGraphError(null); }
                    catch { setGraphError("Invalid JSON"); }
                  }}
                  rows={6}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
                {graphError && <p className="text-xs text-destructive mt-1">{graphError}</p>}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Paste the JSON from the canvas export, or build a graph in the{" "}
                  <Link to="/canvas" className="text-primary">Canvas</Link> and copy node data.
                </p>
              </Field>

              <div className="rounded-xl bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground/80 flex items-center gap-1">
                  <Sparkles className="size-3 text-primary" /> Revenue split
                </p>
                <p>You earn <b>30%</b> of each run (default). Platform keeps 70%.</p>
                <p>Each time a user loads your template they pay {form.run_cost_aura} Aura → you earn ~{(form.run_cost_aura * 0.3).toFixed(1)} Aura per run.</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowForm(false)} disabled={submitMut.isPending}>
                Cancel
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={() => submitMut.mutate()}
                disabled={submitMut.isPending || !form.name.trim() || !!graphError}
              >
                {submitMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Upload className="size-4" />
                    {editingId ? "Resubmit" : "Submit for review"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-1">
      <Icon className="size-4 text-muted-foreground" />
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
