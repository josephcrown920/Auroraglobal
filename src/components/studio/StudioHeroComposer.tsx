import { useState } from "react";
import { ImagePlus, Loader2, Plus, SendHorizonal, Film, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Collage strips behind the composer — real Aurora renders, dimmed. */
const COLLAGE: string[] = [
  "/hero/hero-1.png",
  "/hero/hero-3.png",
  "/hero/hero-colors.png",
  "/hero/hero-5.png",
  "/hero/hero-perform-anywhere.png",
  "/hero/hero-7.png",
];

export type ComposerMode = "image" | "video";

type ModelOption = { value: string; label: string };

type Props = {
  prompt: string;
  onPromptChange: (v: string) => void;
  mode: ComposerMode;
  onModeChange: (m: ComposerMode) => void;
  imageModels: ModelOption[];
  videoModels: ModelOption[];
  imageModel: string;
  onImageModelChange: (v: string) => void;
  videoModel: string;
  onVideoModelChange: (v: string) => void;
  costLabel: string;
  busy: boolean;
  hasReferences: boolean;
  onOpenReferences: () => void;
  onGenerate: () => void;
};

/** Full-screen creation hero — the first thing a signed-in user sees.
 *  Owner-approved direction: the "CREATE SOMETHING NEW." slide (charcoal,
 *  violet brand accents, outlined display word) over an Aurora render collage,
 *  with the big Image/Video prompt composer front and center.
 *  All generation state lives in StudioPage; this is purely the entry surface. */
export function StudioHeroComposer(p: Props) {
  const [focused, setFocused] = useState(false);
  const models = p.mode === "image" ? p.imageModels : p.videoModels;
  const model = p.mode === "image" ? p.imageModel : p.videoModel;
  const onModelChange = p.mode === "image" ? p.onImageModelChange : p.onVideoModelChange;

  return (
    <section className="relative overflow-hidden bg-black">
      {/* ── Collage backdrop ─────────────────────────────────────── */}
      <div aria-hidden className="absolute inset-0 grid grid-cols-3 gap-1 opacity-25">
        {COLLAGE.map((src, i) => (
          <div key={src} className={cn("overflow-hidden", i % 2 === 1 && "translate-y-6")}>
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0.96) 100%)",
        }}
      />

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-4 pb-10 pt-12 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] tracking-widest text-zinc-300 uppercase backdrop-blur">
          <span className="rounded bg-brand px-1.5 py-px text-[9px] font-bold uppercase text-white">New</span>
          Seedance video · coming soon
        </span>

        {/* CUTLAB-slide display type: heavy caps, middle word outlined */}
        <h1 className="mt-6 text-left w-full font-black uppercase leading-[0.95] tracking-tight text-white [font-size:clamp(2.6rem,11vw,4.5rem)]">
          Create
          <br />
          <span
            className="text-transparent"
            style={{ WebkitTextStroke: "1.5px rgba(255,255,255,0.85)" }}
          >
            Something
          </span>
          <br />
          New<span className="text-brand">.</span>
        </h1>
        <p className="mt-4 w-full text-left text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500">
          Images · Video · Built for artists
        </p>

        {/* Image / Video toggle */}
        <div className="mt-7 flex w-full max-w-sm rounded-full border border-white/10 bg-zinc-900/80 p-1 backdrop-blur">
          {(
            [
              { key: "image" as const, label: "Image", icon: Sparkles },
              { key: "video" as const, label: "Video", icon: Film },
            ]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => p.onModeChange(t.key)}
              aria-pressed={p.mode === t.key}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors",
                p.mode === t.key
                  ? "bg-white/12 text-white shadow-[0_0_16px_-6px_rgba(139,92,246,0.6)]"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Composer card */}
        <div
          className={cn(
            "mt-4 w-full rounded-2xl border bg-zinc-900/70 p-3 text-left backdrop-blur-xl transition-colors",
            focused ? "border-brand/50" : "border-white/10",
          )}
        >
          <div className="flex gap-3">
            <button
              type="button"
              onClick={p.onOpenReferences}
              aria-label={p.hasReferences ? "Edit reference photos" : "Add a reference photo"}
              className={cn(
                "flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed transition-colors",
                p.hasReferences
                  ? "border-brand/50 bg-brand/10 text-brand"
                  : "border-white/15 bg-white/5 text-zinc-500 hover:border-white/30 hover:text-zinc-300",
              )}
            >
              {p.hasReferences ? <ImagePlus className="size-5" /> : <Plus className="size-5" />}
            </button>
            <textarea
              rows={3}
              value={p.prompt}
              onChange={(e) => p.onPromptChange(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={
                p.mode === "image"
                  ? "Try describing the image you want to create"
                  : "Describe the video — motion, camera, mood"
              }
              className="min-h-16 flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Select value={model} onValueChange={onModelChange}>
              <SelectTrigger className="h-9 w-auto max-w-[190px] rounded-full border-white/10 bg-white/5 px-3 text-xs text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="rounded-full bg-brand px-3 py-1.5 text-[11px] font-bold uppercase tabular-nums text-white">
              {p.costLabel}
            </span>

            <button
              type="button"
              disabled={p.busy || !p.prompt.trim()}
              onClick={p.onGenerate}
              aria-label="Generate"
              className="ml-auto flex size-10 items-center justify-center rounded-full bg-[#8b5cf6] text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.7)] transition-colors hover:bg-[#7c3aed] disabled:opacity-40"
            >
              {p.busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />}
            </button>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-zinc-600">
          Every render lands in your Gallery · Aura never expires
        </p>
      </div>
    </section>
  );
}
