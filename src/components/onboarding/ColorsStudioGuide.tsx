import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, Sparkles, ImagePlus, RefreshCw, Camera, Check, ArrowRight, Palette, Wand2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    n: "01",
    icon: Camera,
    title: "Gather your references",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/30",
    dot: "bg-violet-500",
    lines: [
      "Selfie — clear face shot, the AI uses this to lock in your exact features, skin tone, and likeness.",
      "Optional: a Colors Show screenshot for the mic and studio setup reference.",
      "Optional: outfit photo — flat lay or a photo of the clothes you want to wear in the scene.",
      "Optional: location or vibe reference — indoor studio, outdoor, concert stage.",
    ],
    prompt: null,
  },
  {
    n: "02",
    icon: Palette,
    title: "Generate the wide angle",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    dot: "bg-emerald-500",
    lines: [
      "Upload your selfie (+ outfit/location refs if you have them).",
      "Choose your background color — hot pink, deep blue, red, any solid color works.",
      "Set aspect ratio to 9:16 for vertical video output.",
      "Use the full-body prompt below, swapping your outfit and color details.",
    ],
    prompt: `Place the subject into a minimalist studio performance scene. Full-body side profile pose, arms slightly extended forward as if performing. Use the exact suspended vintage studio microphone — identical shape, hanging from ceiling at chest level. Environment is a seamless hot pink cyclorama studio — background and floor are one continuous hot pink color. Soft even glossy lighting with smooth gradient. Preserve exact facial likeness, beard, skin tone, hairstyle, body proportions. Outfit: yellow jacket, black shorts, white socks, black shoes. Cinematic studio lighting, rim light separation, ultra-realistic skin texture, 4K photoreal quality.`,
  },
  {
    n: "03",
    icon: Layers,
    title: "Generate the close-up",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    dot: "bg-amber-500",
    lines: [
      "Same flow — upload selfie + same references as the wide shot.",
      "Use the close-up prompt below for a medium chest-up angle.",
      "The AI will match your face exactly from both shots — consistent identity.",
      "Generate 2–3 variations and pick the best angle for each.",
    ],
    prompt: `Place the subject into a studio performance scene. Medium close-up from chest up. Subject turned slightly to side but mostly facing camera — approximately 30-45° angled pose. Suspended vintage studio microphone at mouth level with same spacing as reference. Seamless continuous hot pink cyclorama background filling entire frame top to bottom, no visible floor line. Preserve exact facial likeness, beard, hairstyle, skin tone from reference. Outfit: yellow jacket, black shorts. Pose natural and expressive as if mid-performance. Soft even studio lighting, subtle rim light separation, ultra-realistic skin texture, shallow depth of field, 4K photoreal quality.`,
  },
  {
    n: "04",
    icon: RefreshCw,
    title: "Get more angles (optional)",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10 border-cyan-500/30",
    dot: "bg-cyan-500",
    lines: [
      "Upload your wide shot result as a reference and use short re-angle prompts to create new shots.",
      "Side profile: 'super close up, from the side front angle of the man, keep bokeh depth of field'",
      "Low angle: 'low angle looking up at the subject, dramatic perspective, keep bokeh depth of field'",
      "More angles = more cuts in your final video = more cinematic.",
    ],
    prompt: `super close up, from the side front angle of the man, keep bokeh depth of field`,
  },
  {
    n: "05",
    icon: Wand2,
    title: "Take it to Perform Anywhere",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/30",
    dot: "bg-primary",
    lines: [
      "Save your generated images — these are your scene references.",
      "Record yourself performing your song from the exact same two angles.",
      "Go to Perform Anywhere and upload each AI image + matching phone recording.",
      "Aurora transfers your real movement into the AI scene — no studio needed.",
    ],
    prompt: null,
    cta: { label: "Open Perform Anywhere", to: "/motion" as const },
  },
];

export function ColorsStudioGuide() {
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
          <span className="size-8 rounded-xl flex items-center justify-center bg-violet-500/15 border border-violet-500/30">
            <Palette className="size-4 text-violet-400" />
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold">Colors Studio workflow guide</p>
            <p className="text-xs text-muted-foreground">References → Wide shot → Close-up → Perform Anywhere · 5 steps</p>
          </div>
        </div>
        {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-border">
          {/* step dots */}
          <div className="pt-4 flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setExpandedStep(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  expandedStep === i ? "flex-[2] " + s.dot : "flex-1 bg-border hover:bg-muted-foreground/40",
                )}
              />
            ))}
          </div>

          <div className="space-y-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isExpanded = expandedStep === i;
              return (
                <div
                  key={i}
                  className={cn("rounded-xl border overflow-hidden transition-colors", isExpanded ? s.bg : "border-border bg-card/20")}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedStep(isExpanded ? null : i)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className={cn("size-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold", isExpanded ? s.dot + " text-white" : "bg-muted text-muted-foreground")}>
                      {s.n}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold", isExpanded ? "text-foreground" : "text-muted-foreground")}>{s.title}</p>
                    </div>
                    <Icon className={cn("size-4 shrink-0", isExpanded ? s.color : "text-muted-foreground/40")} />
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
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Prompt · copy &amp; customize</p>
                            <button
                              type="button"
                              onClick={() => copyPrompt(s.prompt!, i)}
                              className="text-[10px] font-semibold text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                              {copiedIdx === i ? <><Check className="size-3" /> Copied</> : "Copy prompt"}
                            </button>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed font-mono line-clamp-5">{s.prompt}</p>
                        </div>
                      )}

                      {s.cta && (
                        <Link
                          to={s.cta.to}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary no-underline hover:text-primary/80"
                        >
                          {s.cta.label} <ArrowRight className="size-3" />
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Pro tip:</span> Change "hot pink" to any color in the prompts. Change the outfit description to match what you're actually wearing. Generate 3–5 angles from your base scene — then animate each one in Perform Anywhere with your original phone recording.
          </div>
        </div>
      )}
    </div>
  );
}
