import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Sparkles, Camera, Film, Check, ArrowRight, Palette, Phone, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    n: "01",
    icon: Palette,
    title: "Generate your AI scene",
    where: "Colors Studio",
    to: "/colors" as const,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    dot: "bg-red-400",
    lines: [
      "Go to Colors Studio and pick a background color — hot pink, deep blue, any vibe.",
      "Upload a selfie (identity reference) and optionally a Colors screenshot for the mic/setup.",
      "Generate two angles: full-body wide shot and medium close-up.",
      "Pro tip: be specific about your outfit in the prompt — jacket, shoes, chain — all of it.",
    ],
    prompt: `Place the subject into a minimalist studio performance scene. Full-body side profile, arms slightly extended as if performing. Suspended vintage studio microphone at chest level. Seamless hot pink cyclorama — background and floor are one continuous color. Preserve exact facial likeness, beard, skin tone, outfit. Cinematic studio lighting, 4K photoreal.`,
  },
  {
    n: "02",
    icon: Phone,
    title: "Record your performance",
    where: "Your phone",
    to: null,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/30",
    dot: "bg-cyan-400",
    lines: [
      "Film yourself performing your song from the SAME two angles as the images you generated.",
      "Match the pose and framing as closely as possible — wide/full-body + medium close-up.",
      "Background and outfit don't matter. Only your body position and movement.",
      "Perform with energy — the motion transfer picks up on your movement quality.",
    ],
    prompt: null,
  },
  {
    n: "03",
    icon: Upload,
    title: "Upload to Perform Anywhere",
    where: "Perform Anywhere",
    to: "/motion" as const,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    dot: "bg-emerald-400",
    lines: [
      "Switch to the Performance Shot tab.",
      "Upload your AI-generated image as the Avatar.",
      "Upload your phone recording as the Performance video.",
      "Add a short context prompt (e.g. 'a man rapping inside a studio') to prevent artifacts.",
    ],
    prompt: `a man performing and singing expressively in a studio`,
  },
  {
    n: "04",
    icon: Film,
    title: "Animate both angles",
    where: "Perform Anywhere",
    to: "/motion" as const,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/30",
    dot: "bg-primary",
    lines: [
      "Generate the wide shot and close-up separately — each with its own phone recording.",
      "The closer your phone angles match the AI images, the better the motion transfer locks.",
      "Combine both clips in CapCut or any editor — cut between angles on the beat.",
      "Add your song audio and you have a full Colors-style performance video.",
    ],
    prompt: null,
  },
];

export function PerformAnywhereGuide() {
  const [open, setOpen] = useState(true);
  const [expandedStep, setExpandedStep] = useState<number | null>(0);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const copyPrompt = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="rounded-2xl border border-border bg-card/40 backdrop-blur overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-card/60 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="size-8 rounded-xl flex items-center justify-center bg-primary/15 border border-primary/30">
            <Sparkles className="size-4 text-primary" />
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold">How to use Perform Anywhere</p>
            <p className="text-xs text-muted-foreground">Colors Studio → Phone → Animate · 4 steps</p>
          </div>
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-border">
          <div className="pt-4 grid grid-cols-4 gap-1.5 text-center text-[13px] text-muted-foreground font-medium uppercase tracking-wider">
            {STEPS.map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className={cn("size-7 rounded-full border flex items-center justify-center text-[13px] font-bold transition-colors", expandedStep === i ? s.bg + " " + s.color : "border-border bg-card/40")}>
                  {s.n}
                </div>
                <span className="leading-tight hidden sm:block">{s.title.split(" ").slice(0, 2).join(" ")}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isExpanded = expandedStep === i;
              return (
                <div key={i} className={cn("rounded-xl border overflow-hidden transition-colors", isExpanded ? s.bg : "border-border bg-card/20")}>
                  <button
                    type="button"
                    onClick={() => setExpandedStep(isExpanded ? null : i)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className={cn("size-6 rounded-full flex items-center justify-center shrink-0", isExpanded ? s.dot + " text-white" : "bg-muted text-muted-foreground")}>
                      <Icon className="size-3.5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold", isExpanded ? "text-foreground" : "text-muted-foreground")}>{s.title}</p>
                      <p className="text-sm text-muted-foreground">{s.where}</p>
                    </div>
                    <span className="shrink-0">{isExpanded ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3">
                      <ul className="space-y-2">
                        {s.lines.map((line, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="mt-1.5 size-1.5 rounded-full bg-current shrink-0 opacity-60" />
                            {line}
                          </li>
                        ))}
                      </ul>

                      {s.prompt && (
                        <div className="rounded-xl bg-background/60 border border-border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[13px] font-semibold uppercase tracking-wider text-muted-foreground">Example prompt</p>
                            <button
                              type="button"
                              onClick={() => copyPrompt(s.prompt!, i)}
                              className="text-[13px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                              {copiedIdx === i ? <><Check className="size-3" /> Copied</> : "Copy"}
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{s.prompt}</p>
                        </div>
                      )}

                      {s.to && (
                        <Link
                          to={s.to}
                          className={cn("inline-flex items-center gap-1.5 text-xs font-semibold no-underline", s.color)}
                        >
                          Open {s.where} <ArrowRight className="size-3" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">The secret:</span> The magic is in matching your phone angles to the AI-generated images. The closer the match, the better the motion transfer locks on. Take a few attempts — it's worth it.
          </div>
        </div>
      )}
    </div>
  );
}
