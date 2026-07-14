import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { lookupDeviceCode, approveDeviceCode } from "@/lib/cli-device.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, Terminal, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/cli/authorize")({
  component: AuthorizePage,
  head: () => ({
    meta: [
      { title: "Authorize Aurora CLI" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AuthorizePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const lookup = useServerFn(lookupDeviceCode);
  const approve = useServerFn(approveDeviceCode);

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "ready" | "approved" | "expired" | "missing">("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/cli/authorize";
      navigate({ to: "/auth", search: { next: here } as never });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("code");
    if (c) setCode(c);
  }, []);

  useEffect(() => {
    if (!user || !code || code.length < 8) return;
    setStatus("checking");
    lookup({ data: { userCode: code } }).then((res) => {
      if (!res.found) return setStatus("missing");
      if (res.expired) return setStatus("expired");
      if (res.status !== "pending") return setStatus("approved");
      setStatus("ready");
    }).catch(() => setStatus("missing"));
  }, [user, code]);

  async function onApprove() {
    setBusy(true);
    try {
      await approve({ data: { userCode: code } });
      setStatus("approved");
      toast.success("CLI authorized — return to your terminal");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to authorize");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <main className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</main>;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <Link to="/" className="font-semibold no-underline text-foreground flex items-center gap-2">
          <Sparkles className="size-4 text-primary" /> Aurora
        </Link>
        <Link to="/dashboard" className="text-sm text-foreground/70 no-underline">Dashboard</Link>
      </header>
      <section className="max-w-md mx-auto px-6 py-12">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Terminal className="size-6" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Authorize Aurora CLI</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Enter the code shown in your terminal to grant the CLI access to your account.
          </p>

          <div className="text-left mb-4">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="text-center text-lg tracking-widest mt-2"
            />
          </div>

          {status === "ready" && (
            <Button className="w-full" onClick={onApprove} disabled={busy}>
              {busy ? "Authorizing…" : "Authorize CLI"}
            </Button>
          )}
          {status === "approved" && (
            <div className="text-sm text-emerald-400 flex items-center justify-center gap-2 mt-2">
              <CheckCircle2 className="size-4" /> Done — return to your terminal.
            </div>
          )}
          {status === "expired" && <p className="text-sm text-destructive">Code expired. Run <code>aurora login</code> again.</p>}
          {status === "missing" && code.length >= 8 && <p className="text-sm text-destructive">Code not found.</p>}
        </div>
      </section>
    </main>
  );
}