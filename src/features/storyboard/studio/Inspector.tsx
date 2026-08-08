import { useEffect, useRef, useState } from "react";
import { streamImage } from "@/lib/streamImage";
import type { Board, ShotNode } from "@/lib/board-store";
import { VideoAgentPanel } from "./VideoAgentPanel";

export function Inspector({
  shot,
  board,
  onChange,
  onDelete,
}: {
  shot: ShotNode;
  board: Board;
  onChange: (patch: Partial<ShotNode>) => void;
  onDelete: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [isFinal, setIsFinal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(null);
    setIsFinal(false);
    setError(null);
  }, [shot.id]);

  function buildPrompt() {
    const chars = board.characters
      .map((c) => `${c.name}: ${c.description}. Wardrobe: ${c.wardrobe}. Props: ${c.props}`)
      .join(" | ");
    const base =
      shot.prompt.trim() ||
      [shot.title, shot.shotType, shot.frame, shot.wardrobe, shot.mood, shot.note]
        .filter(Boolean)
        .join(", ");
    return `Cinematic music video still. ${base}. Style: ${board.stylePreset}. ${
      chars ? `Characters — ${chars}.` : ""
    }`;
  }

  async function generate() {
    const prompt = buildPrompt();
    if (!prompt.trim()) {
      setError("Add a prompt or fill in a few fields first.");
      return;
    }
    setBusy(true);
    setError(null);
    setIsFinal(false);
    setPreview(null);
    try {
      let last = "";
      await streamImage("/api/generate-image", prompt, (url, final) => {
        last = url;
        setPreview(url);
        setIsFinal(final);
      });
      onChange({ imageUrl: last });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  function onUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => onChange({ imageUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          {shot.kind === "video" ? "Video node" : "Inspector"}
        </span>
        <button onClick={onDelete} className="text-xs text-destructive hover:underline">
          Delete node
        </button>
      </div>

      {shot.kind === "video" && (
        <VideoAgentPanel shot={shot} board={board} onChange={onChange} />
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) onUpload(file);
        }}
        className="rounded-xl overflow-hidden border border-dashed border-border bg-muted/30 aspect-video grid place-items-center"
      >
        {preview ? (
          <img
            src={preview}
            alt=""
            className={"w-full h-full object-cover transition " + (isFinal ? "blur-0" : "blur-md")}
          />
        ) : shot.imageUrl ? (
          <img src={shot.imageUrl} alt={shot.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground px-4 text-center">
            Drop an image here, upload, or generate a frame
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={generate}
          disabled={busy}
          className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy ? "Generating…" : shot.imageUrl ? "Regenerate" : "Generate frame"}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          Upload frame
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <Field label="Title">
        <input
          className="sb-input"
          value={shot.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Scene">
          <select
            className="sb-input"
            value={shot.scene}
            onChange={(e) => onChange({ scene: e.target.value })}
          >
            {["Intro", "Verse", "Chorus", "Bridge", "Outro"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Duration · ${shot.duration}s`}>
          <input
            type="range"
            min={0.5}
            max={20}
            step={0.5}
            value={shot.duration}
            onChange={(e) => onChange({ duration: Number(e.target.value) })}
            className="w-full accent-[var(--primary)]"
          />
        </Field>
      </div>
      <Field label="Shot type">
        <input
          className="sb-input"
          value={shot.shotType}
          onChange={(e) => onChange({ shotType: e.target.value })}
        />
      </Field>
      <Field label="Frame / camera">
        <input
          className="sb-input"
          value={shot.frame}
          onChange={(e) => onChange({ frame: e.target.value })}
        />
      </Field>
      <Field label="Wardrobe">
        <input
          className="sb-input"
          value={shot.wardrobe}
          onChange={(e) => onChange({ wardrobe: e.target.value })}
        />
      </Field>
      <Field label="Mood">
        <input
          className="sb-input"
          value={shot.mood}
          onChange={(e) => onChange({ mood: e.target.value })}
        />
      </Field>
      <Field label="Director note">
        <textarea
          rows={3}
          className="sb-input"
          value={shot.note}
          onChange={(e) => onChange({ note: e.target.value })}
        />
      </Field>
      <Field label="Image prompt">
        <textarea
          rows={4}
          className="sb-input"
          value={shot.prompt}
          placeholder="Overrides the auto-built prompt when set."
          onChange={(e) => onChange({ prompt: e.target.value })}
        />
      </Field>
      <p className="text-[11px] text-muted-foreground">
        Changes save automatically to this browser.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
