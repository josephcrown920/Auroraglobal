import { useState } from "react";
import { Layers, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { STYLE_BLUEPRINTS } from "@/lib/batch/style-blueprints";
import { makeCollection, type BatchCollection } from "@/lib/batch/collection";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onComplete?: (collection: BatchCollection) => void;
  /** Pre-fill prompt (e.g. from a studio generation) */
  initialPrompt?: string;
};

const COUNT_OPTIONS = [2, 4, 6, 8, 12, 20, 30] as const;
type CountOption = (typeof COUNT_OPTIONS)[number];

export function BatchDrawer({ open, onClose, onComplete, initialPrompt = "" }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [count, setCount] = useState<CountOption>(4);
  const [blueprintId, setBlueprintId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleRun = async () => {
    if (!prompt.trim()) {
      toast.error("Enter a prompt first");
      return;
    }
    setBusy(true);
    try {
      const { batchGenerate } = await import("@/lib/batch.functions");
      const results = await batchGenerate({
        data: {
          basePrompt: prompt.trim(),
          count,
          blueprintId: blueprintId ?? undefined,
        },
      });
      const succeeded = results.filter((r) => r.ok);
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        toast.warning(`${succeeded.length}/${count} items completed (${failed.length} failed)`);
      } else {
        toast.success(`Batch of ${count} ready!`);
      }
      const col = makeCollection(`Batch ${new Date().toLocaleTimeString()}`, prompt.trim(), succeeded, blueprintId ?? undefined);
      onComplete?.(col);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg bg-[var(--color-canvas)] border border-border rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <h2 className="text-lg font-semibold">Batch Generate</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/8 text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Prompt</label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to generate across all variations…"
            className="resize-none"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Style</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setBlueprintId(null)}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs text-left transition-all",
                !blueprintId
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="font-medium block">No style</span>
              <span className="text-[10px] opacity-70">Use prompt as-is</span>
            </button>
            {STYLE_BLUEPRINTS.map((bp) => (
              <button
                key={bp.id}
                onClick={() => setBlueprintId(bp.id)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs text-left transition-all",
                  blueprintId === bp.id
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="font-medium block">{bp.label}</span>
                <span className="text-[10px] opacity-70">{bp.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Variations</label>
          <div className="flex gap-2 flex-wrap">
            {COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setCount(n)}
                className={cn(
                  "rounded-xl border px-3 py-1.5 text-sm font-medium transition-all",
                  count === n
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            ~{count * 10} Aura · {count} images generated in parallel
          </p>
        </div>

        <Button
          onClick={handleRun}
          disabled={busy || !prompt.trim()}
          variant="premium"
          className="w-full"
        >
          {busy ? (
            <><Loader2 className="size-4 animate-spin mr-2" /> Generating {count} images…</>
          ) : (
            <><Sparkles className="size-4 mr-2" /> Run batch of {count}</>
          )}
        </Button>
      </div>
    </div>
  );
}
