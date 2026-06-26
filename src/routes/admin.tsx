import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { adminOverview, adminGrantCredits } from "@/lib/admin.functions";
import { listWorkers, upsertWorker, deleteWorker, pingWorker } from "@/lib/workers.functions";
import { ModelBadge } from "@/components/ModelBadge";
import { Shield, Sparkles, Loader2, Users, DollarSign, ImagePlay, Coins, ArrowRight, Server, Trash2, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { AdminGate, hasAdminToken } from "@/components/AdminGate";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";


export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — Aurora" },
      { name: "description", content: "Aurora internal admin console for operators." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AdminPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [unlocked, setUnlocked] = useState<boolean>(() => hasAdminToken());

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const overviewFn = useServerFn(adminOverview);
  const grantFn = useServerFn(adminGrantCredits);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => overviewFn(),
    enabled: !!user && unlocked,
    refetchInterval: 30_000,
  });


  const [tab, setTab] = useState<"gens" | "users" | "payments" | "workers">("gens");
  const [grantUser, setGrantUser] = useState("");
  const [grantAmount, setGrantAmount] = useState(100);

  const grantMut = useMutation({
    mutationFn: async () => grantFn({ data: { userId: grantUser, amount: grantAmount } }),
    onSuccess: () => { toast.success("Credits granted"); qc.invalidateQueries({ queryKey: ["admin-overview"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }

  if (!unlocked) return <AdminGate onUnlocked={() => setUnlocked(true)} />;


  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4">
          <Shield className="size-12 text-muted-foreground mx-auto" />
          <h1 className="text-xl font-semibold">Admin access required</h1>
          <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Forbidden"}</p>
          <Link to="/dashboard" className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
            Back to dashboard <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    );
  }

  const s = data?.stats;

  return (
    <main className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 md:px-10 py-5 border-b border-border bg-card/40 backdrop-blur-xl">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src={auroraLogo.url} alt="Aurora" className="size-8 rounded-xl object-contain" />
          Aurora Studio
          <span className="ml-2 text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center gap-1"><Shield className="size-3" /> Admin</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/admin/orchestration" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Activity className="size-3.5" /> Orchestration</Link>
          <Link to="/admin/smoke" className="text-sm text-muted-foreground hover:text-foreground">Smoke test</Link>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">My dashboard</Link>
          <Link to="/studio" className="text-sm text-muted-foreground hover:text-foreground">Studio</Link>
          <Button variant="ghost" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>Sign out</Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 md:p-10 space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Admin overview</h1>
          <p className="text-muted-foreground mt-1">Every user. Every generation. Every payment.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon={Users} label="Users" value={s?.totalUsers ?? "—"} />
          <Stat icon={ImagePlay} label="Generations" value={s?.totalGens ?? "—"} sub={`${s?.totalImages ?? 0} img · ${s?.totalVideos ?? 0} vid`} />
          <Stat icon={DollarSign} label="Revenue (USD)" value={s ? `$${s.totalRevenueUsd.toFixed(2)}` : "—"} />
          <Stat icon={Coins} label="Margin (60%)" value={s ? `$${(s.totalRevenueUsd * 0.6).toFixed(2)}` : "—"} />
        </div>

        {/* Grant credits */}
        <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Grant credits</h2>
          <div className="flex flex-wrap gap-2">
            <Input placeholder="user_id (uuid)" value={grantUser} onChange={(e) => setGrantUser(e.target.value)} className="flex-1 min-w-[260px]" />
            <Input type="number" value={grantAmount} onChange={(e) => setGrantAmount(parseInt(e.target.value || "0"))} className="w-32" />
            <Button onClick={() => grantMut.mutate()} disabled={!grantUser || grantMut.isPending}>{grantMut.isPending ? "…" : "Grant"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Tip: copy a user_id from the Users tab below.</p>
        </section>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          {(["gens", "users", "payments", "workers"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "gens" ? "Generations" : t === "workers" ? "GPU Workers" : t}
            </button>
          ))}
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

        {tab === "gens" && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {(data?.generations ?? []).map((g) => (
              <div key={g.id} className="rounded-xl overflow-hidden border border-border bg-card/40">
                <div className="aspect-square bg-background/40">
                  {g.result_image_url ? (
                    <img src={g.result_image_url} alt="" className="w-full h-full object-cover" />
                  ) : g.result_video_url ? (
                    <video src={g.result_video_url} className="w-full h-full object-cover" muted playsInline />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground p-2 text-center">{g.status}{g.error ? `: ${g.error.slice(0, 40)}` : ""}</div>
                  )}
                </div>
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <ModelBadge model={g.model} size="xs" />
                    <span className="text-[9px] text-muted-foreground">{new Date(g.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{g.prompt}</p>
                  <p className="text-[9px] font-mono text-muted-foreground/60 truncate" title={g.user_id}>{g.user_id.slice(0, 8)}…</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "users" && (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left p-3">Email</th><th className="text-left p-3">Name</th><th className="text-right p-3">Credits</th><th className="text-right p-3">Spent</th><th className="text-left p-3">User ID</th></tr>
              </thead>
              <tbody>
                {(data?.users ?? []).map((u) => (
                  <tr key={u.user_id} className="border-t border-border hover:bg-card/40">
                    <td className="p-3">{u.email ?? "—"}</td>
                    <td className="p-3">{u.display_name ?? "—"}</td>
                    <td className="p-3 text-right">{u.credits}</td>
                    <td className="p-3 text-right">{u.lifetime_credits_purchased}</td>
                    <td className="p-3"><button onClick={() => { setGrantUser(u.user_id); navigator.clipboard.writeText(u.user_id); toast.success("Copied"); }} className="text-xs font-mono text-muted-foreground hover:text-foreground">{u.user_id.slice(0, 12)}…</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "payments" && (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="text-left p-3">When</th><th className="text-left p-3">Reference</th><th className="text-right p-3">Amount</th><th className="text-right p-3">Credits</th><th className="text-left p-3">Status</th></tr>
              </thead>
              <tbody>
                {(data?.payments ?? []).map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3 text-xs">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="p-3 font-mono text-xs">{p.reference}</td>
                    <td className="p-3 text-right">{p.currency} {(p.amount_kobo / 100).toFixed(2)}</td>
                    <td className="p-3 text-right">{p.credits_granted}</td>
                    <td className={`p-3 text-xs ${p.status === "succeeded" ? "text-emerald-500" : "text-muted-foreground"}`}>{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === "workers" && <WorkersPanel />}
      </div>
    </main>
  );
}

function heartbeatAge(ts: string | null | undefined): string {
  if (!ts) return "never";
  const ageMs = Date.now() - new Date(ts).getTime();
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s ago`;
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)}m ago`;
  return `${Math.round(ageMs / 3_600_000)}h ago`;
}

function WorkersPanel() {
  const listFn = useServerFn(listWorkers);
  const saveFn = useServerFn(upsertWorker);
  const delFn = useServerFn(deleteWorker);
  const pingFn = useServerFn(pingWorker);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["workers"], queryFn: () => listFn() });
  const blank = { 
    name: "", endpoint_url: "", auth_token: "", region: "global", 
    capabilities: "image,video", priority: 100, max_concurrency: 4, 
    protocol: "custom" as "custom" | "runpod", 
    worker_role: "" as string, 
    runpod_sync: false 
  };
  const [form, setForm] = useState(blank);
  const reset = () => setForm(blank);
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2"><Server className="size-4" /> Register GPU worker</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <Input placeholder="Name (e.g. runpod-a100-eu)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input placeholder="Endpoint URL (https://…)" value={form.endpoint_url} onChange={e => setForm({ ...form, endpoint_url: e.target.value })} />
          <Input placeholder="Auth bearer token (optional)" value={form.auth_token} onChange={e => setForm({ ...form, auth_token: e.target.value })} />
          <Input placeholder="Region" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} />
          <Input placeholder="Capabilities (comma: image,video,lipsync,upscale)" value={form.capabilities} onChange={e => setForm({ ...form, capabilities: e.target.value })} />
          <Input type="number" placeholder="Max concurrency" value={form.max_concurrency} onChange={e => setForm({ ...form, max_concurrency: parseInt(e.target.value || "4") })} />
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
            value={form.protocol} 
            onChange={e => setForm({ ...form, protocol: e.target.value as "custom" | "runpod" })}
          >
            <option value="custom">Protocol: Custom (POST /generate)</option>
            <option value="runpod">Protocol: RunPod (/runsync or /run)</option>
          </select>
          <select 
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
            value={form.worker_role} 
            onChange={e => setForm({ ...form, worker_role: e.target.value })}
          >
            <option value="">Role: (auto from capabilities)</option>
            <option value="comfyui">comfyui — image / upscale</option>
            <option value="kling">kling — video</option>
            <option value="lipsync">lipsync</option>
            <option value="motion">motion — video</option>
          </select>
          {form.protocol === "runpod" && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
              <input type="checkbox" checked={form.runpod_sync} onChange={e => setForm({ ...form, runpod_sync: e.target.checked })} />
              Use <code>/runsync</code> (synchronous) instead of <code>/run</code> + poll
            </label>
          )}
        </div>
        <Button onClick={async () => {
          await saveFn({ data: {
            name: form.name, endpoint_url: form.endpoint_url, auth_token: form.auth_token || null,
            region: form.region, capabilities: form.capabilities.split(",").map(s => s.trim()).filter(Boolean),
            models: [], priority: form.priority, max_concurrency: form.max_concurrency, status: "active",
            protocol: form.protocol, worker_role: form.worker_role || null, runpod_sync: form.runpod_sync,
          } });
          toast.success("Worker added"); reset(); qc.invalidateQueries({ queryKey: ["workers"] });
        }} disabled={!form.name || !form.endpoint_url}>Add worker</Button>
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Custom contract:</strong> <code>POST /generate</code> with flat JSON body → <code>{"{ url }"}</code>. Also requires <code>GET /health</code>.</p>
          <p><strong>RunPod contract:</strong> <code>POST /runsync</code> (preferred) or <code>POST /run</code> + <code>{"GET /status/{id}"}</code> with body <code>{"{ input: { kind, prompt, image_urls, audio_url, video_url, model, duration, resolution } }"}</code>. Auth token sent as <code>Authorization: Bearer …</code>.</p>
          <p>Lower <strong>priority</strong> number = tried first. Use higher priority (e.g. 200) for serverless/auto-scale fallback workers.</p>
        </div>
      </section>
      {isLoading ? <div className="text-sm text-muted-foreground">Loading…</div> : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-card/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Endpoint</th>
                <th className="text-left p-3">Caps</th>
                <th className="text-left p-3">Protocol</th>
                <th className="text-right p-3">Load</th>
                <th className="text-left p-3">Heartbeat</th>
                <th className="text-left p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {(data?.workers ?? []).map(w => {
                const staleMs = w.last_heartbeat ? Date.now() - new Date(w.last_heartbeat).getTime() : Infinity;
                const isStale = staleMs > 5 * 60_000;
                const protocol = (w as Record<string, unknown>).protocol as string ?? "custom";
                const role = (w as Record<string, unknown>).worker_role as string | null;
                const runpodSync = (w as Record<string, unknown>).runpod_sync as boolean;
                return (
                  <tr key={w.id} className="border-t border-border">
                    <td className="p-3">
                      {w.name}
                      {role ? <span className="ml-1 text-xs text-muted-foreground">({role})</span> : null}
                    </td>
                    <td className="p-3 font-mono text-xs truncate max-w-[220px]">{w.endpoint_url}</td>
                    <td className="p-3 text-xs">{(w.capabilities ?? []).join(", ")}</td>
                    <td className="p-3 text-xs">{protocol}{protocol === "runpod" && runpodSync ? " · sync" : ""}</td>
                    <td className="p-3 text-right">{w.in_flight}/{w.max_concurrency}</td>
                    <td className={`p-3 text-xs ${isStale ? "text-amber-500" : "text-emerald-500"}`}>
                      {heartbeatAge(w.last_heartbeat)}
                    </td>
                    <td className={`p-3 text-xs ${w.status === "active" ? "text-emerald-500" : "text-muted-foreground"}`}>{w.status}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={async () => { const r = await pingFn({ data: { id: w.id } }); toast(r.ok ? `OK · ${r.latency_ms}ms${r.detail ? ` · ${r.detail}` : ""}` : `Down: ${r.error ?? r.status}`); qc.invalidateQueries({ queryKey: ["workers"] }); }}><Activity className="size-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={async () => { if (!confirm("Delete?")) return; await delFn({ data: { id: w.id } }); qc.invalidateQueries({ queryKey: ["workers"] }); }}><Trash2 className="size-4" /></Button>
                    </td>
                  </tr>
                );
              })}
              {(data?.workers ?? []).length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground text-sm">No workers registered. Add your GPU orchestrator endpoint above to enable failover.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <section>
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">Recent worker jobs</h3>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-card/60 uppercase text-muted-foreground"><tr><th className="text-left p-2">When</th><th className="text-left p-2">Kind</th><th className="text-left p-2">Status</th><th className="text-right p-2">ms</th><th className="text-left p-2">Error</th></tr></thead>
            <tbody>{(data?.jobs ?? []).slice(0, 30).map(j => (
              <tr key={j.id} className="border-t border-border"><td className="p-2">{new Date(j.created_at).toLocaleTimeString()}</td><td className="p-2">{j.kind}</td><td className={`p-2 ${j.status === "ok" ? "text-emerald-500" : "text-red-500"}`}>{j.status}</td><td className="p-2 text-right">{j.latency_ms ?? "—"}</td><td className="p-2 truncate max-w-[300px]">{j.error ?? ""}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <Icon className="size-5 text-primary mb-3" />
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}