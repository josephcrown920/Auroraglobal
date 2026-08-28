// Small inline form used both by the toolbar "+" (new root shot) and by
// dragging a connection off a node onto empty canvas (branch).
import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { MODELS, LOOKS, type LookId } from "@/lib/models";
import type { GenKind } from "./types";

export interface AddStepValue {
  modelId: string;
  lookId: LookId;
  prompt: string;
  kind: GenKind;
}

interface Props {
  x: number;
  y: number;
  defaultKind: GenKind;
  defaultModelId?: string;
  onConfirm: (v: AddStepValue) => void;
  onClose: () => void;
}

export function AddStepPopover({ x, y, defaultKind, defaultModelId, onConfirm, onClose }: Props) {
  const [modelId, setModelId] = useState(defaultModelId ?? MODELS[0].id);
  const [lookId, setLookId] = useState<LookId>("boudoir");
  const [prompt, setPrompt] = useState("");

  return (
    <div
      className="absolute z-30 w-64 rounded-2xl border border-white/10 bg-[#110a14] p-3.5 shadow-2xl shadow-black/60 animate-fade-in"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
          Add {defaultKind === "video" ? "video" : "step"}
        </span>
        <button onClick={onClose} className="text-white/30 hover:text-white">
          <X size={12} />
        </button>
      </div>

      <div className="mb-2.5">
        <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-white/35">
          Character
        </label>
        <div className="flex gap-1.5">
          {MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setModelId(m.id)}
              className={`overflow-hidden rounded-lg border size-8 shrink-0 ${
                modelId === m.id ? "border-rose-400" : "border-white/10 opacity-50"
              }`}
              title={m.name}
            >
              <img src={m.cover} alt={m.name} className="size-full object-cover object-top" />
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2.5">
        <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-white/35">
          Look
        </label>
        <select
          value={lookId}
          onChange={(e) => setLookId(e.target.value as LookId)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white outline-none"
        >
          {LOOKS.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-white/35">
          Extra details (optional)
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          placeholder="Outfit, setting, styling…"
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white placeholder:text-white/25 outline-none"
        />
      </div>

      <button
        onClick={() => onConfirm({ modelId, lookId, prompt, kind: defaultKind })}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-pink-600 py-2 text-[11px] font-bold text-white"
      >
        <Sparkles size={11} /> Generate · 1 Aura
      </button>
    </div>
  );
}
