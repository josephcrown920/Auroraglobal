import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { GradedImage } from "./GradedImage";
import { NEUTRAL_GRADE, PRESETS } from "@/lib/grade";
import type { Grade } from "@/lib/studio-types";

export interface ColorScene {
  id: string;
  name: string;
  src: string;
  grade: Grade;
  gradePreset?: string;
  gradeNote?: string;
  grading?: boolean;
}

export function ColorPanel({
  scenes,
  activeId,
  onSelect,
  onGrade,
  onAutoGrade,
  onAutoGradeAll,
  autoAllBusy,
}: {
  scenes: ColorScene[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onGrade: (id: string, grade: Grade, preset?: string, note?: string) => void;
  onAutoGrade: (id: string) => void;
  onAutoGradeAll: () => void;
  autoAllBusy: boolean;
}) {
  const active = scenes.find((scene) => scene.id === activeId) ?? scenes[0];
  const [preset, setPreset] = useState(active?.gradePreset ?? "neutral");
  if (!active) return <section className="rounded-2xl border border-white/10 p-8 text-center text-sm text-white/40">Create a scene to start grading.</section>;
  const apply = (key: string) => {
    const selected = PRESETS.find((candidate) => candidate.key === key);
    if (selected) { setPreset(key); onGrade(active.id, selected.grade, key); }
  };
  return <section className="grid gap-5 rounded-2xl border border-white/10 bg-black/20 p-4 lg:grid-cols-[1.4fr_1fr]"><div className="aspect-video overflow-hidden rounded-xl"><GradedImage src={active.src} grade={active.grade} alt={active.name} /></div><div><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold">Color room</h2><p className="mt-1 text-xs text-white/40">Grade each plate before export.</p></div><button onClick={() => onAutoGradeAll()} disabled={autoAllBusy} className="rounded-lg border border-white/10 px-2.5 py-2 text-[10px] text-white/60">{autoAllBusy ? <Loader2 className="size-3 animate-spin" /> : "Grade all"}</button></div><div className="mb-4 flex gap-2 overflow-auto">{scenes.map((scene) => <button key={scene.id} onClick={() => onSelect(scene.id)} className={`size-14 shrink-0 overflow-hidden rounded-lg border ${scene.id === active.id ? "border-primary" : "border-white/10"}`}><img src={scene.src} alt="" className="h-full w-full object-cover" /></button>)}</div><div className="grid grid-cols-2 gap-2">{PRESETS.map((candidate) => <button key={candidate.key} onClick={() => apply(candidate.key)} className={`rounded-lg border p-2 text-left ${preset === candidate.key ? "border-primary/60 bg-primary/10" : "border-white/8 bg-white/[.03]"}`}><span className="block text-xs text-white/75">{candidate.label}</span><span className="mt-1 block text-[10px] text-white/35">{candidate.blurb}</span></button>)}</div><button onClick={() => onAutoGrade(active.id)} disabled={active.grading} className="mt-4 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">{active.grading ? <Loader2 className="size-4 animate-spin" /> : <><Sparkles className="mr-1 inline size-3.5" />Suggest a grade</>}</button><button onClick={() => onGrade(active.id, NEUTRAL_GRADE, "neutral")} className="ml-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55">Reset</button></div></section>;
}