import { useState } from "react";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles, Trash2, Image as ImageIcon, Video } from "lucide-react";
import { SoulShell } from "@/features/soul/soul-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSoul, listSouls, deleteSoul, trainSoul } from "@/lib/soul.functions";

export const Route = createLazyFileRoute("/soul")({
  component: () => (
    <SoulShell>
      <SoulDashboard />
    </SoulShell>
  ),
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Not trained yet",
  training: "Training…",
  ready: "Ready",
  failed: "Training failed",
};

function SoulDashboard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSouls);
  const createFn = useServerFn(createSoul);
  const deleteFn = useServerFn(deleteSoul);
  const trainFn = useServerFn(trainSoul);

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: souls = [], isLoading } = useQuery({
    queryKey: ["souls"],
    queryFn: () => listFn(),
    refetchInterval: (query) =>
      (query.state.data ?? []).some((s) => s.status === "training") ? 8000 : false,
  });

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createFn({ data: { name: name.trim() } });
      setName("");
      qc.invalidateQueries({ queryKey: ["souls"] });
      toast.success("Soul created. Upload training photos next.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create soul");
    } finally {
      setCreating(false);
    }
  };

  const handleRetrain = async (soulId: string) => {
    try {
      const res = await trainFn({ data: { soulId } });
      if (!res.ok) throw new Error(res.error);
      toast.success("Training started");
      qc.invalidateQueries({ queryKey: ["souls"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start training");
    }
  };

  const handleDelete = async (soulId: string) => {
    try {
      await deleteFn({ data: { soulId } });
      qc.invalidateQueries({ queryKey: ["souls"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete soul");
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-glass-strong)] p-4">
        <label htmlFor="soul-name" className="mb-2 block text-sm font-medium">
          Name a new character
        </label>
        <div className="flex gap-2">
          <Input
            id="soul-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maya, Street Muse"
            maxLength={100}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={creating || !name.trim()} variant="premium">
            {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            New Soul
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : souls.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] p-10 text-center">
          <Sparkles className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No souls yet. Create one above, then upload at least 10 photos to train it.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {souls.map((soul) => (
            <li
              key={soul.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-glass-strong)] p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{soul.name}</p>
                <p
                  className={`text-xs ${
                    soul.status === "ready"
                      ? "text-emerald-400"
                      : soul.status === "failed"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {STATUS_LABEL[soul.status]}
                  {soul.stale ? " · stalled — retry training" : ""}
                  {soul.status === "training" ? ` (${soul.progress}%)` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {soul.status === "ready" ? (
                  <>
                    <Button asChild size="icon" variant="ghost" title="Generate images">
                      <Link to="/soul/generate" search={{ soulId: soul.id }}>
                        <ImageIcon className="size-4" />
                      </Link>
                    </Button>
                    <Button asChild size="icon" variant="ghost" title="Generate video">
                      <Link to="/soul/generate/video" search={{ soulId: soul.id }}>
                        <Video className="size-4" />
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleRetrain(soul.id)}>
                    {soul.status === "pending" ? "Upload photos" : "Retry"}
                  </Button>
                )}
                {soul.status === "pending" && (
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/soul/train" search={{ soulId: soul.id }}>
                      Train
                    </Link>
                  </Button>
                )}
                <Button size="icon" variant="ghost" title="Delete" onClick={() => handleDelete(soul.id)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
