import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { adminUnlock } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

const KEY = "aurora_admin_token";
export function hasAdminToken() {
  if (typeof window === "undefined") return false;
  try { return !!sessionStorage.getItem(KEY); } catch { return false; }
}

export function AdminGate({ onUnlocked }: { onUnlocked: () => void }) {
  const unlockFn = useServerFn(adminUnlock);
  const [username, setUsername] = useState("");
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await unlockFn({ data: { username, passcode } });
      try { sessionStorage.setItem(KEY, res.token); } catch {}
      onUnlocked();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="size-9 rounded-xl grid place-items-center bg-primary/10 border border-primary/30">
            <Shield className="size-4 text-primary" />
          </span>
          <div>
            <h1 className="font-semibold">Restricted</h1>
            <p className="text-xs text-muted-foreground">Owner credentials required.</p>
          </div>
        </div>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" autoFocus />
        <Input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Passcode" autoComplete="current-password" />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Unlock"}
        </Button>
      </form>
    </div>
  );
}
