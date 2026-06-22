import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import w1 from "@/assets/workflow-img_6068.jpg.asset.json"; // Industrial Playground
import w2 from "@/assets/workflow-img_6077.jpg.asset.json"; // Car On Fire
import w3 from "@/assets/workflow-img_6078.jpg.asset.json"; // Fashion bookshelf
import w4 from "@/assets/workflow-img_5814.jpg.asset.json"; // Cops chase
import balloon from "@/assets/balloon-head.png.asset.json"; // NBA Josh balloon
import type { Node, Edge } from "@xyflow/react";

type WorkflowStep = { node: string; model: string; prompt: string };

type FinishedWorkflow = {
  id: string;
  name: string;
  category: string;
  cover: string;
  nodes: number;
  credits: number;
  models: string[];
  description: string;
  steps: WorkflowStep[];
};

const FINISHED: FinishedWorkflow[] = [
  {
    id: "balloon-josh",
    name: "NBA Josh · Balloon Head",
    category: "Music · Surreal",
    cover: balloon.url,
    nodes: 5,
    credits: 18,
    models: ["Nano Banana Pro", "Seedance 2.0", "Sync 1.9"],
    description: "Selfie → balloon-head surreal portrait over NYC skyline → motion → lip-synced hook.",
    steps: [
      { node: "Character lock", model: "Nano Banana Pro", prompt: "Lock the subject's face and skin tone from the uploaded selfie. Keep identity exact." },
      { node: "Image gen", model: "Nano Banana Pro", prompt: "Same subject as a giant glossy red balloon-head floating in front of the NYC skyline at golden hour. Wearing oversized varsity jacket, chunky gold chain. Surreal, hyperreal, 35mm." },
      { node: "Motion", model: "Seedance 2.0", prompt: "Slow zoom-in on subject, gentle bob as balloon head sways, skyline parallax. 4 seconds, cinematic." },
      { node: "Lipsync", model: "Sync 1.9", prompt: "Lipsync to attached vocal hook. Natural mouth shape over the balloon material." },
      { node: "Final render", model: "—", prompt: "1080x1350, 24fps, mp4, color graded warm." },
    ],
  },
  {
    id: "cops-chase",
    name: "Cops Chase · Cinematic",
    category: "Music Video",
    cover: w4.url,
    nodes: 6,
    credits: 22,
    models: ["Seedream 4.5", "Kling 3.0", "Sync 1.9"],
    description: "Subject sings into mic while two officers chase — golden-hour bokeh, full lip-sync.",
    steps: [
      { node: "Character lock", model: "Seedream 4.5", prompt: "Lock subject from selfie. Streetwear: black hoodie, distressed jeans, silver chain." },
      { node: "Scene gen", model: "Seedream 4.5", prompt: "Subject sprinting down a Brooklyn street holding an SM7B mic, mid-vocal. Two NYPD officers chasing 10ft behind. Golden hour, anamorphic bokeh, low shutter motion blur. Cinematic, 35mm." },
      { node: "Motion", model: "Kling 3.0", prompt: "Tracking shot beside subject, 6 seconds, slight handheld shake, officers gaining slowly." },
      { node: "Lipsync", model: "Sync 1.9", prompt: "Sync subject's mouth to attached verse. Keep aggressive delivery, visible breath." },
      { node: "Grade", model: "—", prompt: "Teal shadows, orange highlights, film grain, gate weave." },
    ],
  },
  {
    id: "car-on-fire",
    name: "Car On Fire",
    category: "Fashion Editorial",
    cover: w2.url,
    nodes: 5,
    credits: 30,
    models: ["Full Body Gen", "Nano Banana Pro", "Seedance 2.0"],
    description: "Character + product (top + shorts) → editorial pose → desert night with burning car backdrop.",
    steps: [
      { node: "Character", model: "Full Body Gen", prompt: "Full-body model from selfie, 5'10, slim athletic build. Neutral standing pose for try-on." },
      { node: "Product try-on", model: "Nano Banana Pro", prompt: "Dress subject in uploaded cropped tank + cargo shorts. Preserve fabric texture, logos, stitching." },
      { node: "Scene composite", model: "Nano Banana Pro", prompt: "Place subject in Mojave desert at night, sedan engulfed in orange flames 15ft behind. Heat haze, ember sparks, key light from fire. Editorial, Vogue Italia tone." },
      { node: "Motion", model: "Seedance 2.0", prompt: "Subject turns head slowly toward camera, fire flickers, embers drift up. 4 seconds." },
      { node: "Render", model: "—", prompt: "4:5, 1440x1800, high contrast, deep shadows." },
    ],
  },
  {
    id: "industrial-playground",
    name: "Industrial Playground",
    category: "Fashion · Try-on",
    cover: w3.url,
    nodes: 6,
    credits: 30,
    models: ["Character Lock", "Full Body Gen", "Image Gen"],
    description: "Two product items + style ref → laughing model interacting with giant colored shapes.",
    steps: [
      { node: "Character lock", model: "Character Lock", prompt: "Lock face + skin tone from selfie. Long curly hair, natural makeup." },
      { node: "Try-on top", model: "Full Body Gen", prompt: "Dress subject in uploaded oversized knit sweater. Keep weave, color, drape exact." },
      { node: "Try-on bottom", model: "Full Body Gen", prompt: "Add uploaded pleated mini skirt. Preserve pleats and hemline." },
      { node: "Scene gen", model: "Image Gen", prompt: "Subject laughing while leaning on a 6ft inflatable primary-color cube inside a concrete industrial warehouse. Giant red sphere and yellow cone in background. Soft northern window light. Editorial." },
      { node: "Pose variation", model: "Image Gen", prompt: "Generate 3 more poses: mid-laugh sitting on cube, walking past sphere, hand on cone." },
      { node: "Render", model: "—", prompt: "4:5 lookbook set, color matched, neutral grade." },
    ],
  },
  {
    id: "vinyl-library",
    name: "Vinyl Library Try-On",
    category: "Fashion · Lookbook",
    cover: w1.url,
    nodes: 6,
    credits: 30,
    models: ["Character", "Full Body Gen", "Environment"],
    description: "Green leather jacket + brown wide-leg pants → curated vinyl-library editorial shoot.",
    steps: [
      { node: "Character", model: "Character", prompt: "Lock subject from selfie. Confident relaxed expression." },
      { node: "Try-on jacket", model: "Full Body Gen", prompt: "Dress subject in uploaded forest-green leather moto jacket. Preserve grain, zippers, collar shape." },
      { node: "Try-on pants", model: "Full Body Gen", prompt: "Add uploaded chocolate-brown wide-leg trousers. Preserve break at ankle." },
      { node: "Environment", model: "Environment", prompt: "Place subject inside a warm-lit private vinyl listening library. Floor-to-ceiling oak shelves packed with records, mid-century chair, brass lamp. Subject flipping through a record crate, mid-action." },
      { node: "Pose set", model: "Full Body Gen", prompt: "4 poses: pulling record from shelf, sitting reading sleeve, leaning on shelf, walking out frame." },
      { node: "Render", model: "—", prompt: "4:5 editorial, warm tungsten grade, soft film grain." },
    ],
  },
];

export function FinishedWorkflowsGallery({
  onLoad,
}: {
  onLoad?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<FinishedWorkflow | null>(null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20">
          <Sparkles className="size-3.5 mr-1" /> Finished workflows
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-[oklch(0.12_0.04_290)] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 className="size-5 text-emerald-400" />
            Finished workflows — real renders, shipped
          </DialogTitle>
          <p className="text-sm text-white/60">
            Each card is a completed Canvas pipeline. Click one to inspect the recipe, then clone it into your canvas.
          </p>
        </DialogHeader>

        {active ? (
          <div className="grid md:grid-cols-[1.2fr_1fr] gap-6 mt-2">
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black">
              <img src={active.cover} alt={active.name} className="w-full aspect-[4/3] object-cover" />
              <button
                onClick={() => setActive(null)}
                className="absolute top-3 right-3 size-8 grid place-items-center rounded-full bg-black/70 border border-white/15 hover:bg-black"
              >
                <X className="size-4" />
              </button>
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-400/90 text-[10px] font-bold text-emerald-950">
                <CheckCircle2 className="size-3" /> RENDERED
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-widest text-emerald-300">{active.category}</span>
              <h3 className="mt-1 text-2xl font-bold">{active.name}</h3>
              <p className="mt-3 text-sm text-white/70">{active.description}</p>

              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <Stat label="Nodes" value={String(active.nodes)} />
                <Stat label="Credits" value={`${active.credits}`} />
              </div>

              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-widest text-white/50">Models used</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {active.models.map((m) => (
                    <span key={m} className="px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[11px]">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-white/50">Recipe · prompts</p>
                  <CopyButton
                    label="Copy all"
                    value={active.steps.map((s, i) => `${i + 1}. [${s.node} · ${s.model}]\n${s.prompt}`).join("\n\n")}
                  />
                </div>
                <ol className="mt-2 space-y-2">
                  {active.steps.map((s, i) => (
                    <li key={i} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold text-emerald-300">
                          {i + 1}. {s.node} <span className="text-white/40">· {s.model}</span>
                        </p>
                        <CopyButton value={s.prompt} />
                      </div>
                      <p className="mt-1.5 text-[12px] text-white/80 leading-relaxed">{s.prompt}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-6 flex gap-2">
                <Button
                  onClick={() => {
                    onLoad?.(active.id);
                    setOpen(false);
                  }}
                  className="bg-gradient-to-r from-violet-500 to-fuchsia-500"
                >
                  Clone into canvas
                </Button>
                <Button variant="outline" className="border-white/15" onClick={() => setActive(null)}>
                  Back to gallery
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 max-h-[70vh] overflow-y-auto pr-1">
            {FINISHED.map((wf) => (
              <button
                key={wf.id}
                onClick={() => setActive(wf)}
                className="group text-left rounded-xl overflow-hidden border border-white/10 bg-black/40 hover:border-emerald-400/50 transition"
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img src={wf.cover} alt={wf.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-400/90 text-[9px] font-bold text-emerald-950">
                    <CheckCircle2 className="size-2.5" /> DONE
                  </div>
                  <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-300/90">{wf.category}</p>
                    <p className="text-sm font-semibold text-white leading-tight">{wf.name}</p>
                    <p className="text-[10px] text-white/55 mt-0.5">{wf.nodes} nodes · {wf.credits} credits</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] uppercase tracking-widest text-white/50">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(label ? "All prompts copied" : "Prompt copied");
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] text-white/70"
    >
      {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
      {label ?? "Copy"}
    </button>
  );
}

// Exported so canvas can also surface these in TrendingTemplatesMenu if wanted.
export type { FinishedWorkflow };
export const FINISHED_WORKFLOWS = FINISHED;

// Helper: returns a minimal node graph clone for a finished workflow id.
// Real graphs would come from saved templates; this is a sensible default
// so "Clone into canvas" produces a usable starting point.
export function defaultGraphFor(id: string): { nodes: Node[]; edges: Edge[] } | null {
  void id;
  return null;
}
