import { useState } from "react";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, AlertCircle } from "lucide-react";
import { SoulShell } from "@/features/soul/soul-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listSouls, generateSoulImage, soulImageCost, type SoulImageResult } from "@/lib/soul.functions";

export const Route = createLazyFileRoute("/soul/generate")({
  component: () => (
    <SoulShell>
      <SoulGenerateImagePage />
    </SoulShell>
  ),
});

const ASPECTS = ["1:1", "9:16", "16:9", "4:5"];

function SoulGenerateImagePage() {
  const search = Route.useSearch();
  const listFn = useServerFn(listSouls);
  const generateFn = useServerFn(generateSoulImage);

  const { data: souls = [], isLoading: soulsLoading } = useQuery({ queryKey: ["souls"], queryFn: () => listFn() });
  const readySouls = souls.filter((s) => s.status === "ready");

  const [soulId, setSoulId] = useState(search.soulId ?? "");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [numOutputs, setNumOutputs] = useState(1);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SoulImageResult[]>([]);

  const cost = soulImageCost() * numOutputs;
  const effectiveSoulId = soulId || readySouls[0]?.id || "";

  const handleGenerate = async () => {
    if (!effectiveSoulId || !prompt.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const res = await generateFn({
        data: { soulId: effectiveSoulId, prompt: prompt.trim(), aspectRatio, numOutputs },
      });
      setResults(res.results);
      const failed = res.results.filter((r) => r.status === "failed").length;
      if (failed === res.results.length) toast.error("All images failed to generate");
      else if (failed > 0) toast.warning(`${res.results.length - failed} of ${res.results.length} images succeeded`);
      else toast.success("Images generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  if (!soulsLoading && readySouls.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] p-8 text-center">
        <AlertCircle className="mx-auto mb-3 size-6 text-muted-foreground" />
        <p className="mb-3 text-sm text-muted-foreground">You need at least one trained soul before generating images.</p>
        <Button asChild variant="premium">
          <Link to="/soul">Train a soul</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium">Character</label>
        <Select value={effectiveSoulId} onValueChange={setSoulId}>
          <SelectTrigger><SelectValue placeholder="Choose a soul" /></SelectTrigger>
          <SelectContent>
            {readySouls.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Describe the scene</label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. walking through a neon-lit city street at night, cinematic lighting"
          rows={4}
          maxLength={1000}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Aspect ratio</label>
          <Select value={aspectRatio} onValueChange={setAspectRatio}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASPECTS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Number of images</label>
          <Select value={String(numOutputs)} onValueChange={(v) => setNumOutputs(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={handleGenerate}
        disabled={loading || !effectiveSoulId || !prompt.trim()}
        variant="premium"
        size="lg"
        className="w-full"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        Generate ({cost} Aura)
      </Button>

      {results.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {results.map((r) => (
            <div key={r.index} className="overflow-hidden rounded-xl border border-[color:var(--border-strong)]">
              {r.status === "succeeded" && r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" className="block">
                  <img src={r.url} alt={`Generated ${r.index + 1}`} className="aspect-square w-full object-cover" />
                </a>
              ) : (
                <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-destructive/10 p-3 text-center">
                  <AlertCircle className="size-5 text-destructive" />
                  <p className="text-xs text-destructive">{r.error ?? "Failed"}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
