import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { adminListMarketplaceTemplates, adminReviewMarketplaceTemplate } from "@/lib/marketplace.functions";
import { AdminGate, hasAdminToken } from "@/components/AdminGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Loader2, ArrowLeft, CheckCircle2, XCircle, Clock, Store, Eye } from "lucide-react";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";

export const Route = createFileRoute("/admin/templates")({
  component: AdminTemplatesPage,
  head: () => ({
    meta: [
      { title: "Template Review — Admin · Aurora" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  pending:  { label: "Pending",  className: "bg-amber-500/15 text-amber-400 border border-amber-500/30" },
  approved: { label: "Approved", className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" },
  rejected: { label: "Rejected", className: "bg-red-500/15 text-red-400 border border-red-500/30" },
  draft:    { label: "Draft",    className: "bg-muted text-muted-foreground" },
};

function AdminTemplatesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [unlocked, setUnlocked] = useState(() => hasAdminToken());
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const listFn = useServerFn(adminListMarketplaceTemplates);
  const reviewFn = useServerFn(adminReviewMarketplaceTemplate);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["admin-marketplace-templates"],
    queryFn: () => listFn(),
    enabled: !!user && unlocked,
    refetchInterval: 30_000,
  });

  const reviewMut = useMutation({
    mutationFn: (vars: { id: string; action: "approve" | "reject"; rejection_reason?: string }) =>
      reviewFn({ data: vars }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === "approve" ? "Template approved" : "Template rejected");
      setRejectId(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin-marketplace-templates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;

  const shown = filter === "all" ? templates : templates.filter((t) => t.status === filter);
  const pendingCount = templates.filter((t) => t.status === "pending").length;
  const previewTemplate = previewId ? templates.find((t) => t.id === previewId) : null;

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-border bg-card/40 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="flex items-center gap-2 font-semibold tracking-tight">
            <img src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
            Aurora Admin
            <span className="ml-2 text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center gap-1">
              <Shield className="size-3" /> Admin
            </span>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Store className="size-4" /> Template Review
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
              <Store className="size-6 text-primary" /> Marketplace Templates
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review, approve, or reject creator-submitted templates.
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              <Clock className="size-4" /> {pendingCount} pending review
            </div>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 border-b border-border">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${
                filter === f ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {f} {f !== "all" && <span className="text-xs ml-1">({templates.filter((t) => t.status === f).length})</span>}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}

        {!isLoading && shown.length === 0 && (
          <div className="rounded-2xl border border-border bg-card/40 p-10 text-center text-muted-foreground">
            No {filter === "all" ? "" : filter} templates yet.
          </div>
        )}

        <div className="space-y-3">
          {shown.map((t) => {
            const chip = STATUS_CHIP[t.status] ?? STATUS_CHIP.draft;
            return (
              <div
                key={t.id}
                className="rounded-2xl border border-border bg-card/40 p-5 flex flex-col sm:flex-row gap-4"
              >
                {t.thumbnail_url && (
                  <img
                    src={t.thumbnail_url}
                    alt={t.name}
                    className="w-24 h-24 rounded-xl object-cover shrink-0 border border-border"
                  />
                )}
                {!t.thumbnail_url && (
                  <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Store className="size-8 text-muted-foreground/30" />
                  </div>
                )}

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-base">{t.name}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${chip.className}`}>
                      {chip.label}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">{t.run_cost_aura} Aura / run</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full bg-muted">{t.category}</span>
                    {t.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-muted/50">{tag}</span>
                    ))}
                    <span>by <b>{t.creator_display_name ?? t.creator_user_id.slice(0, 8)}</b></span>
                    <span>creator cut: {t.cut_pct}%</span>
                    <span>{t.run_count} runs</span>
                    <span>{new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                  {t.rejection_reason && (
                    <p className="text-xs text-red-400 mt-1">Rejection reason: {t.rejection_reason}</p>
                  )}
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                    className="text-xs gap-1"
                  >
                    <Eye className="size-3.5" /> Graph
                  </Button>
                  {t.status !== "approved" && (
                    <Button
                      size="sm"
                      className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 gap-1"
                      onClick={() => reviewMut.mutate({ id: t.id, action: "approve" })}
                      disabled={reviewMut.isPending}
                    >
                      <CheckCircle2 className="size-3.5" /> Approve
                    </Button>
                  )}
                  {t.status !== "rejected" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1 text-xs"
                      onClick={() => { setRejectId(t.id); setRejectReason(""); }}
                      disabled={reviewMut.isPending}
                    >
                      <XCircle className="size-3.5" /> Reject
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <XCircle className="size-5 text-destructive" /> Reject template
            </h2>
            <p className="text-sm text-muted-foreground">Optionally add a reason the creator will see.</p>
            <Input
              placeholder="Reason (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setRejectId(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() =>
                  reviewMut.mutate({ id: rejectId, action: "reject", rejection_reason: rejectReason || undefined })
                }
                disabled={reviewMut.isPending}
              >
                {reviewMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Reject"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Graph preview panel */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={() => setPreviewId(null)}>
          <div
            className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full space-y-3 shadow-2xl max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{previewTemplate.name} — Graph JSON</h2>
              <Button variant="ghost" size="sm" onClick={() => setPreviewId(null)}>Close</Button>
            </div>
            <pre className="text-xs bg-muted/50 rounded-xl p-4 overflow-auto max-h-[50vh] leading-relaxed">
              {JSON.stringify(previewTemplate.graph_json, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </main>
  );
}
