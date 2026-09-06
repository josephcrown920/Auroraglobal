import { authNextSearch } from "@/lib/auth-return-path";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listWorkers } from "@/lib/workers.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Rocket,
  Shield,
  Loader2,
  Copy,
  Download,
  ExternalLink,
  Server,
  CheckCircle2,
  XCircle,
  Cpu,
} from "lucide-react";

export const Route = createLazyFileRoute("/admin/gpu")({ component: AdminGpuPage });

// Script/notebook files served from public/downloads/gpu/ (copies of workers/*).
const LAUNCHERS = [
  {
    id: "kaggle",
    name: "Kaggle — free T4/P100 (~30 h/week)",
    scriptPath: "/downloads/gpu/aurora_worker_kaggle.py",
    notebookPath: "/downloads/gpu/aurora_worker_kaggle.ipynb",
    openUrl: "https://www.kaggle.com/code",
    openLabel: "Open Kaggle",
    caps: "Lip-sync (LatentSync). Motion needs ≥24 GB VRAM — not free tier.",
    steps: [
      "New Notebook → Settings: Accelerator = GPU (T4 ×2 or P100), Internet = ON",
      "Add-ons → Secrets: add the 4 secrets below",
      "Paste the script (or import the notebook) and Run",
    ],
  },
  {
    id: "colab",
    name: "Google Colab — free T4 (Pro+ A100 for motion)",
    scriptPath: "/downloads/gpu/aurora_worker_colab.py",
    notebookPath: "/downloads/gpu/aurora_worker_colab.ipynb",
    openUrl: "https://colab.new",
    openLabel: "Open Colab",
    caps: "Lip-sync on any GPU. Motion only on Pro+ A100 (~24 GB).",
    steps: [
      "New notebook → Runtime → Change runtime type → GPU",
      "Secrets panel (key icon): add the 4 secrets, toggle notebook access ON",
      "Paste the script (or upload the notebook) and Run all",
    ],
  },
  {
    id: "comfyui",
    name: "ComfyUI swarm — image, video, motion, lip-sync",
    scriptPath: "/downloads/gpu/aurora_comfyui_launcher.py",
    notebookPath: null,
    openUrl: "https://colab.new",
    openLabel: "Open Colab",
    caps: "Full ComfyUI worker (protocol: comfyui). Advertises only the capabilities the session's GPU can serve.",
    steps: [
      "Works on Kaggle or Colab — same GPU + Internet settings as above",
      "Add the same 4 secrets",
      "Paste the launcher script and Run — registers as a ComfyUI swarm worker",
    ],
  },
] as const;

const SECRETS: { key: string; note: string }[] = [
  { key: "NGROK_AUTHTOKEN", note: "ngrok dashboard → Your Authtoken" },
  { key: "NGROK_STATIC_DOMAIN", note: "ngrok dashboard → Domains → claim a free static domain" },
  { key: "AURORA_URL", note: "this app's base URL, e.g. https://your-app.replit.app" },
  { key: "AURORA_REGISTER_SECRET", note: "must byte-for-byte match the value in Aurora's secrets" },
];

function AdminGpuPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: authNextSearch() });
  }, [user, loading, navigate]);

  const workersFn = useServerFn(listWorkers);
  const workersQ = useQuery({
    queryKey: ["admin-gpu-workers"],
    enabled: !!user,
    queryFn: () => workersFn({}),
    refetchInterval: 15_000,
    staleTime: 0,
  });

  const [copying, setCopying] = useState<string | null>(null);

  const copyScript = async (id: string, path: string) => {
    setCopying(id);
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      await navigator.clipboard.writeText(await res.text());
      toast.success("Script copied — paste it into a notebook cell");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setCopying(null);
    }
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  const workers = (workersQ.data?.workers ?? []) as Record<string, unknown>[];

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/40 pl-24 pr-6 py-4 flex items-center justify-between">
        <Link to="/admin" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 inline-flex items-center gap-1">
            <Shield className="size-3" /> Admin
          </span>
          GPU launch
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link to="/admin/comfy" className="text-muted-foreground hover:text-foreground">ComfyUI admin</Link>
          <Link to="/admin" className="text-muted-foreground hover:text-foreground">Overview</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Rocket className="h-7 w-7 text-primary" /> Launch a free GPU worker
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Run Aurora's worker on a free Kaggle or Colab GPU. The script installs everything, opens a
            stable ngrok tunnel, health-checks, and self-registers below — no dashboard edits.
          </p>
        </div>

        {/* Required secrets */}
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            1 · Notebook secrets (required)
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {SECRETS.map((s) => (
              <div key={s.key} className="rounded-lg border border-border bg-background px-3 py-2.5">
                <code className="text-sm font-semibold text-primary">{s.key}</code>
                <p className="text-xs text-muted-foreground mt-0.5">{s.note}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Values are never shown here. Getting a register 401? Compare the fingerprint the notebook prints
            against Admin → Workers → Recent registration attempts.
          </p>
        </section>

        {/* Launchers */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            2 · Pick a launcher
          </h2>
          <div className="grid lg:grid-cols-3 gap-4">
            {LAUNCHERS.map((l) => (
              <div key={l.id} className="rounded-xl border border-border bg-card p-5 flex flex-col">
                <h3 className="font-semibold flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-primary" /> {l.name}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">{l.caps}</p>
                <ol className="mt-3 space-y-1.5 text-xs text-foreground/80 list-decimal list-inside">
                  {l.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => copyScript(l.id, l.scriptPath)} disabled={copying === l.id}>
                    {copying === l.id ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1" />
                    )}
                    Copy script
                  </Button>
                  {l.notebookPath && (
                    <Button size="sm" variant="outline" asChild>
                      <a href={l.notebookPath} download>
                        <Download className="h-3.5 w-3.5 mr-1" /> Notebook
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="outline" asChild>
                    <a href={l.openUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> {l.openLabel}
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Live workers */}
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              3 · Registered workers (live)
            </h2>
            <span className="text-xs text-muted-foreground">refreshes every 15 s</span>
          </div>
          {workersQ.isLoading ? (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : workers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workers yet. Launch one above — it appears here within seconds of the cell printing
              "[register] OK".
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Protocol</th>
                    <th className="py-2 pr-4">Capabilities</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Endpoint</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((w) => {
                    const status = String(w.status ?? "");
                    const ok = status === "active";
                    return (
                      <tr key={String(w.id)} className="border-b border-border/50">
                        <td className="py-2 pr-4 font-medium">{String(w.name ?? "—")}</td>
                        <td className="py-2 pr-4">
                          <code className="text-xs">{String(w.protocol ?? "—")}</code>
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {Array.isArray(w.capabilities) ? (w.capabilities as string[]).join(", ") : "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center gap-1 text-xs ${ok ? "text-emerald-500" : "text-amber-500"}`}>
                            {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                            {status || "unknown"}
                          </span>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground truncate max-w-[260px]">
                          {String(w.endpoint_url ?? "—")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3 inline-flex items-center gap-1">
            <Server className="h-3.5 w-3.5" /> Full worker management (pause, remove, ping) lives in{" "}
            <Link to="/admin" className="text-primary">Admin → Workers</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
