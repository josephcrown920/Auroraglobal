import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyApiKeys, createApiKey, revokeApiKey } from "@/lib/api-keys.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, KeyRound, Trash2, Terminal } from "lucide-react";

type KeyRow = { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null };

export function ApiKeysPanel() {
  const list = useServerFn(listMyApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => list({}).then((d) => setKeys(d.keys as KeyRow[])).catch(() => {});
  useEffect(() => { reload(); }, []);

  async function onCreate() {
    setBusy(true);
    try {
      const { key } = await create({ data: { name: "CLI" } });
      setFresh(key);
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }

  return (
    <section className="rounded-2xl border border-border bg-card/60 backdrop-blur-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Terminal className="size-3.5" /> CLI API keys
        </h2>
        <Button size="sm" onClick={onCreate} disabled={busy}><KeyRound className="size-3.5 mr-1.5" /> New key</Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Use with <code className="bg-muted px-1 rounded">aurora login</code> or set <code className="bg-muted px-1 rounded">AURORA_API_KEY</code>.
      </p>

      {fresh && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 mb-4">
          <p className="text-xs font-medium mb-1">Copy this now — you won't see it again:</p>
          <div className="flex gap-2 items-center">
            <code className="flex-1 text-xs font-mono break-all bg-background/60 rounded p-2">{fresh}</code>
            <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(fresh); toast.success("Copied"); }}><Copy className="size-3.5" /></Button>
          </div>
        </div>
      )}

      {keys.filter(k => !k.revoked_at).length === 0 ? (
        <p className="text-xs text-muted-foreground">No keys yet.</p>
      ) : (
        <ul className="space-y-2">
          {keys.filter(k => !k.revoked_at).map((k) => (
            <li key={k.id} className="flex items-center justify-between border border-border rounded-lg p-3">
              <div className="text-xs">
                <div className="font-mono">{k.key_prefix}…</div>
                <div className="text-muted-foreground">Created {new Date(k.created_at).toLocaleDateString()}{k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleDateString()}`}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={async () => { await revoke({ data: { id: k.id } }); reload(); }}>
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}