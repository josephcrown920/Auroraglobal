import { useState } from "react";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Video, AlertCircle } from "lucide-react";
import { SoulShell } from "@/features/soul/soul-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listSouls, generateSoulVideo, soulVideoCost } from "@/lib/soul.functions";

export const Route = createLazyFileRoute("/soul/generate/video")({
  component: () => (
    <SoulShell>
      <SoulGenerateVideoPage />
    </SoulShell>
  ),
});

const ASPECTS = ["9:16", "16:9", "1:1"];
const DURATIONS = [4, 5, 8, 10, 15];

function SoulGenerateVideoPage() {
  const search = Route.useSearch();
  const listFn = useServerFn(listSouls);
  const generateFn = useServerFn(generateSoulVideo);

  const { data: souls = [], isLoading: soulsLoading } = useQuery({ queryKey: ["souls"], queryFn: () => listFn() });
  const readySouls = souls.filter((s) => s.status === "ready");

  const [soulId, setSoulId] = useState(search.soulId ?? "");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [duration, setDuration] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url?: string; error?: string } | null>(null);

  const effectiveSoulId = soulId || readySouls[0]?.id || "";
  const cost = soulVideoCost(duration);

  const handleGenerate = async () => {
    if (!effectiveSoulId || !prompt.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await generateFn({
        data: { soulId: effectiveSoulId, prompt: prompt.trim(), durationSeconds: duration, aspectRatio },
      });
      if (res.ok) {
        setResult({ url: res.url });
        toast.success("Video generated");
      } else {
        setResult({ error: res.error });
        toast.error(res.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Video generation failed";
      setResult({ error: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (!soulsLoading && readySouls.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] p-8 text-center">
        <AlertCircle className="mx-auto mb-3 size-6 text-muted-foreground" />
        <p className="mb-3 text-sm text-muted-foreground">You need at least one trained soul before generating video.</p>
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
            {readySouls.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Describe the scene</label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. slow walk through a rainy alley, cinematic, shallow depth of field"
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
          <label className="text-sm font-medium">Duration</label>
          <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => <SelectItem key={d} value={String(d)}>{d}s</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Requires Aurora Soul video to be configured by the owner (SEEDANCE_API_URL / SEEDANCE_API_KEY).
      </p>

      <Button
        onClick={handleGenerate}
        disabled={loading || !effectiveSoulId || !prompt.trim()}
        variant="premium"
        size="lg"
        className="w-full"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
        Generate video ({cost} Aura)
      </Button>

      {result?.url && (
        <video
          src={result.url}
          controls
          playsInline
          className="w-full rounded-xl border border-[color:var(--border-strong)]"
        />
      )}
      {result?.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {result.error}
        </p>
      )}
    </div>
  );
}
