import { authNextSearch } from "@/lib/auth-return-path";
import { AdminGate, useAdminAutoUnlock } from "@/components/AdminGate";
import { adminAddCustomerActivity, adminGetCustomer, adminListCustomers, adminUpsertCustomer } from "@/lib/admin-crm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { Activity, ArrowLeft, Building2, Clock3, Loader2, Mail, RefreshCw, Save, Search, UserRound, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createLazyFileRoute("/admin/crm")({ component: CrmDashboard });

type Stage = "lead" | "trial" | "active" | "at_risk" | "churned" | "vip";
const STAGES: Stage[] = ["lead", "trial", "active", "at_risk", "churned", "vip"];

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function CrmDashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [unlocked, setUnlocked] = useAdminAutoUnlock(!!user);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | Stage>("all");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [loading, navigate, user]);

  const listFn = useServerFn(adminListCustomers);
  const detailFn = useServerFn(adminGetCustomer);
  const saveFn = useServerFn(adminUpsertCustomer);
  const activityFn = useServerFn(adminAddCustomerActivity);

  const customersQuery = useQuery({
    queryKey: ["admin-crm-customers"],
    queryFn: () => listFn(),
    enabled: !!user && unlocked,
    refetchInterval: 60_000,
  });

  const detailQuery = useQuery({
    queryKey: ["admin-crm-customer", selectedId],
    queryFn: () => detailFn({ data: { userId: selectedId! } }),
    enabled: !!user && unlocked && !!selectedId,
  });

  const saveMutation = useMutation({
    mutationFn: saveFn,
    onSuccess: () => {
      toast.success("Customer updated");
      qc.invalidateQueries({ queryKey: ["admin-crm-customers"] });
      qc.invalidateQueries({ queryKey: ["admin-crm-customer", selectedId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update customer"),
  });

  const activityMutation = useMutation({
    mutationFn: activityFn,
    onSuccess: () => {
      toast.success("Activity added");
      qc.invalidateQueries({ queryKey: ["admin-crm-customer", selectedId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add activity"),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (customersQuery.data ?? []).filter((customer: any) => {
      const matchesStage = stageFilter === "all" || customer.lifecycle_stage === stageFilter;
      const haystack = [customer.display_name, customer.email, customer.company_name, customer.user_id, customer.source].filter(Boolean).join(" ").toLowerCase();
      return matchesStage && (!term || haystack.includes(term));
    });
  }, [customersQuery.data, search, stageFilter]);

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;

  const selected = detailQuery.data?.customer;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /></Link>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary"><Users className="size-3.5" /> Customer intelligence</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">CRM</h1>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => customersQuery.refetch()} disabled={customersQuery.isFetching}>
            <RefreshCw className={`mr-2 size-3.5 ${customersQuery.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-5 md:grid-cols-[360px_1fr] md:p-8">
        <section className="min-h-[70vh] overflow-hidden rounded-2xl border border-border bg-card/40">
          <div className="border-b border-border p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, company, ID" className="pl-9" />
            </div>
            <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as "all" | Stage)} className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm">
              <option value="all">All lifecycle stages</option>
              {STAGES.map((stage) => <option key={stage} value={stage}>{stage.replace("_", " ")}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">{filtered.length} customer{filtered.length === 1 ? "" : "s"}</p>
          </div>

          {customersQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>
          ) : customersQuery.error ? (
            <div className="p-5 text-sm text-destructive">{customersQuery.error instanceof Error ? customersQuery.error.message : "Failed to load CRM"}</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No matching customers yet. CRM records can be created when a user enters your lifecycle workflow.</div>
          ) : (
            <div className="max-h-[65vh] overflow-y-auto divide-y divide-border">
              {filtered.map((customer: any) => (
                <button key={customer.user_id} onClick={() => setSelectedId(customer.user_id)} className={`w-full p-4 text-left transition hover:bg-muted/40 ${selectedId === customer.user_id ? "bg-primary/10" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{customer.display_name || customer.email || "Unnamed customer"}</div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{customer.email || customer.user_id}</div>
                    </div>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] capitalize text-muted-foreground">{customer.lifecycle_stage}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{customer.company_name || "No company"}</span>
                    <span>{formatDate(customer.last_seen_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="min-h-[70vh] rounded-2xl border border-border bg-card/40 p-5 md:p-7">
          {!selectedId ? (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
              <UserRound className="mb-4 size-10 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Select a customer</h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">Review lifecycle state, customer notes, first-party product activity, and your internal follow-ups.</p>
            </div>
          ) : detailQuery.isLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>
          ) : detailQuery.error ? (
            <div className="text-sm text-destructive">{detailQuery.error instanceof Error ? detailQuery.error.message : "Failed to load customer"}</div>
          ) : selected ? (
            <CustomerDetail customer={selected} activities={detailQuery.data?.activities ?? []} events={detailQuery.data?.events ?? []} onSave={(data) => saveMutation.mutate(data)} saving={saveMutation.isPending} onActivity={(data) => activityMutation.mutate(data)} addingActivity={activityMutation.isPending} />
          ) : (
            <div className="text-sm text-muted-foreground">This customer has no CRM record yet.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function CustomerDetail({ customer, activities, events, onSave, saving, onActivity, addingActivity }: { customer: any; activities: any[]; events: any[]; onSave: (data: any) => void; saving: boolean; onActivity: (data: any) => void; addingActivity: boolean }) {
  const [stage, setStage] = useState<Stage>(customer.lifecycle_stage);
  const [source, setSource] = useState(customer.source ?? "");
  const [company, setCompany] = useState(customer.company_name ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityBody, setActivityBody] = useState("");

  useEffect(() => {
    setStage(customer.lifecycle_stage);
    setSource(customer.source ?? "");
    setCompany(customer.company_name ?? "");
    setNotes(customer.notes ?? "");
  }, [customer]);

  const timeline = useMemo(() => [
    ...activities.map((item) => ({ ...item, timelineType: "crm" })),
    ...events.map((item) => ({ ...item, timelineType: "event", title: item.name })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 120), [activities, events]);

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary"><UserRound className="size-3.5" /> Customer profile</div>
          <h2 className="mt-1 truncate text-2xl font-semibold">{customer.display_name || customer.email || "Unnamed customer"}</h2>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {customer.email && <span className="inline-flex items-center gap-1"><Mail className="size-3.5" /> {customer.email}</span>}
            <span className="inline-flex items-center gap-1"><Building2 className="size-3.5" /> {customer.company_name || "No company"}</span>
          </div>
        </div>
        <span className="w-fit rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs capitalize text-primary">{customer.lifecycle_stage.replace("_", " ")}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="First seen" value={formatDate(customer.first_seen_at)} />
        <Metric label="Last seen" value={formatDate(customer.last_seen_at)} />
        <Metric label="Last contacted" value={formatDate(customer.last_contacted_at)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">Lifecycle & account</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Lifecycle stage"><select value={stage} onChange={(event) => setStage(event.target.value as Stage)} className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm">{STAGES.map((item) => <option key={item} value={item}>{item.replace("_", " ")}</option>)}</select></Field>
            <Field label="Source"><Input value={source} onChange={(event) => setSource(event.target.value)} placeholder="signup, referral, campaign…" /></Field>
            <Field label="Company"><Input value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Company name" /></Field>
            <div className="flex items-end"><Button className="w-full" onClick={() => onSave({ data: { userId: customer.user_id, lifecycle_stage: stage, source: source || null, company_name: company || null, notes: notes || null } })} disabled={saving}><Save className="mr-2 size-4" /> {saving ? "Saving…" : "Save customer"}</Button></div>
          </div>
          <Field label="Internal notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="Account context, sales notes, product fit, risks…" /></Field>
        </div>

        <div className="space-y-4 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">Add internal activity</h3>
          <Field label="Title"><Input value={activityTitle} onChange={(event) => setActivityTitle(event.target.value)} placeholder="Followed up about video credits" /></Field>
          <Field label="Details"><textarea value={activityBody} onChange={(event) => setActivityBody(event.target.value)} rows={5} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="What happened? What is the next action?" /></Field>
          <Button className="w-full" onClick={() => { onActivity({ data: { userId: customer.user_id, activity_type: "note", title: activityTitle.trim(), body: activityBody.trim() || null } }); setActivityTitle(""); setActivityBody(""); }} disabled={addingActivity || !activityTitle.trim()}><Activity className="mr-2 size-4" /> {addingActivity ? "Adding…" : "Add activity"}</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border">
        <div className="border-b border-border px-4 py-3"><h3 className="text-sm font-semibold">Unified customer timeline</h3><p className="mt-1 text-xs text-muted-foreground">Internal CRM activity plus consent-gated first-party product events.</p></div>
        <div className="max-h-[520px] divide-y divide-border overflow-y-auto">
          {timeline.length === 0 ? <div className="p-6 text-sm text-muted-foreground">No activity recorded yet.</div> : timeline.map((item: any, index) => (
            <div key={`${item.timelineType}-${item.id ?? index}`} className="p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-full bg-muted p-1.5">{item.timelineType === "crm" ? <Activity className="size-3.5" /> : <Clock3 className="size-3.5" />}</span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{item.title}</span><span className="text-[11px] text-muted-foreground">{formatDate(item.created_at)}</span></div><div className="mt-1 text-xs text-muted-foreground">{item.timelineType === "crm" ? item.body || item.activity_type : [item.category, item.entity_type, item.path].filter(Boolean).join(" · ") || "Product event"}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border bg-background/40 p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 text-xs font-medium">{value}</div></div>;
}
