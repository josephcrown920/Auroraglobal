import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { editGeneration } from "@/lib/studio.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Wand2, Download } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [
  { label: "Brighter", prompt: "Increase exposure and add soft cinematic key light. Keep colors natural." },
  { label: "Darker / moodier", prompt: "Lower exposure, deepen shadows, moody low-key lighting, teal-charcoal grade." },
  { label: "Warmer grade", prompt: "Warm orange-and-teal cinematic color grade, golden hour skin tones." },
  { label: "Cooler grade", prompt: "Cool blue cinematic grade, night-time feel, neon ambient light." },
  { label: "Black & white", prompt: "Convert to high-contrast black and white, rich blacks, silver highlights." },
  { label: "Film grain", prompt: "Add subtle 35mm film grain and very slight halation on highlights." },
  { label: "Sharper / 4K", prompt: "Increase sharpness and micro-detail, 4K crisp focus on the face." },
  { label: "Remove background", prompt: "Replace the background with a clean dark studio backdrop, keep the subject untouched." },
  { label: "Change outfit: black hoodie", prompt: "Change the subject's outfit to a fitted plain black hoodie. Keep face, hair and pose identical." },
  { label: "Add iced chain", prompt: "Add a chunky diamond iced-out chain necklace, photoreal jewelry, keep everything else identical." },
];

export function VisualEditDialog({
  open, onOpenChange, sourceId, sourceUrl,
}: { open: boolean; onOpenChange: (v: boolean) => void; sourceId: string; sourceUrl: string }) {
  const qc = useQueryClient();
  const editFn = useServerFn(editGeneration);
  const [prompt, setPrompt] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: async (p: string) => editFn({ data: { sourceId, editPrompt: p } }),
    onSuccess: (res) => {
      setResultUrl(res.resultUrl);
      toast.success("Edit complete · 1 Aura");
      qc.invalidateQueries({ queryKey: ["gallery"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Edit failed"),
  });

  const run = (p: string) => { if (!mut.isPending) mut.mutate(p); };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setResultUrl(null); setPrompt(""); } }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="size-4 text-primary" /> Visual edit</DialogTitle>
          <DialogDescription>Tweak this shot with a prompt or a one-click preset. Each edit costs 1 Aura and saves as a new gallery entry.</DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Original</p>
            <img src={sourceUrl} alt="" className="w-full rounded-xl border border-border object-cover aspect-[4/5]" />
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Edited{mut.isPending ? " · rendering…" : resultUrl ? "" : " · preview"}</p>
            <div className="w-full rounded-xl border border-border aspect-[4/5] bg-card/40 flex items-center justify-center overflow-hidden">
              {mut.isPending ? (
                <Loader2 className="size-6 animate-spin text-primary" />
              ) : resultUrl ? (
                <img src={resultUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <p className="text-xs text-muted-foreground p-4 text-center">Pick a preset or write a prompt below.</p>
              )}
            </div>
            {resultUrl && (
              <a href={resultUrl} download target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs text-primary hover:underline">
                <Download className="size-3" /> Download edited
              </a>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Quick presets</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                disabled={mut.isPending}
                onClick={() => run(p.prompt)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-card/40 hover:bg-card hover:border-primary/50 transition-colors disabled:opacity-40"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Custom prompt</p>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. add stage smoke and concert lighting behind him"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            <Button onClick={() => run(prompt)} disabled={!prompt.trim() || mut.isPending} style={{ background: "var(--gradient-hero)" }}>
              {mut.isPending ? <><Loader2 className="size-4 animate-spin mr-2" /> Editing…</> : <><Wand2 className="size-4 mr-2" /> Apply edit · 1cr</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
