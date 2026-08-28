import { useState } from "react";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Wand2, Palette } from "lucide-react";
import { SoulShell } from "@/features/soul/soul-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vibeMatch, type VibeResult } from "@/lib/soul.functions";

export const Route = createLazyFileRoute("/soul/vibe")({
  component: () => (
    <SoulShell>
      <SoulVibePage />
    </SoulShell>
  ),
});

function SoulVibePage() {
  const navigate = useNavigate();
  const vibeFn = useServerFn(vibeMatch);
  const [imageUrl, setImageUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [vibe, setVibe] = useState<VibeResult | null>(null);

  const handleMatch = async () => {
    if (!imageUrl.trim()) return;
    setLoading(true);
    setVibe(null);
    try {
      const res = await vibeFn({ data: { imageUrl: imageUrl.trim() } });
      setVibe(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't analyze that image");
    } finally {
      setLoading(false);
    }
  };

  const applyToPrompt = () => {
    if (!vibe) return;
    const prompt = `${vibe.description} Mood: ${vibe.moodTags.join(", ")}. Lighting: ${vibe.lightingStyle}. Camera: ${vibe.cameraStyle}.`;
    navigate({ to: "/soul/generate", search: {}, state: { vibePrompt: prompt } as never });
    toast.success("Vibe ready — paste it into your next prompt");
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Paste a reference image URL and Aurora will extract a reusable named vibe — mood, palette, lighting,
        and camera style. This is free — no Aura is charged.
      </p>
      <div className="flex gap-2">
        <Input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
          onKeyDown={(e) => e.key === "Enter" && handleMatch()}
        />
        <Button onClick={handleMatch} disabled={loading || !imageUrl.trim()} variant="premium">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
          Match
        </Button>
      </div>

      {imageUrl.trim() && (
        <img
          src={imageUrl}
          alt="Reference"
          className="max-h-64 w-full rounded-xl border border-[color:var(--border-strong)] object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}

      {vibe && (
        <div className="space-y-3 rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--surface-glass-strong)] p-4">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-[color:var(--brand-accent,theme(colors.primary.DEFAULT))]" />
            <h3 className="font-semibold text-white">{vibe.name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{vibe.description}</p>
          {vibe.moodTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {vibe.moodTags.map((tag) => (
                <span key={tag} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{tag}</span>
              ))}
            </div>
          )}
          {vibe.colorPalette.length > 0 && (
            <div className="flex gap-1.5">
              {vibe.colorPalette.map((color) => (
                <span
                  key={color}
                  title={color}
                  className="size-6 rounded-full border border-white/20"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Lighting: {vibe.lightingStyle} · Camera: {vibe.cameraStyle}
          </p>
          <Button asChild variant="secondary" size="sm" onClick={applyToPrompt}>
            <Link to="/soul/generate">Use this vibe →</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
