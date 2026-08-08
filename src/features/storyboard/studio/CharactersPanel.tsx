import { useState } from "react";
import type { Board, Character } from "@/lib/board-store";
import { uid } from "@/lib/board-store";
import { streamImage } from "@/lib/streamImage";

export function CharactersPanel({
  board,
  onChange,
}: {
  board: Board;
  onChange: (characters: Character[]) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; url: string; final: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function patch(id: string, p: Partial<Character>) {
    onChange(board.characters.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  function sheetPrompt(c: Character) {
    return (
      c.prompt?.trim() ||
      `Character reference sheet for a music video. ${c.name}: ${c.description}. Wardrobe: ${c.wardrobe}. Signature props: ${c.props}. Three-quarter view, full body plus close-up head detail, neutral studio backdrop, consistent lighting. Style: ${board.stylePreset}.`
    );
  }

  async function generateSheet(c: Character) {
    setBusyId(c.id);
    setError(null);
    setPreview(null);
    try {
      let last = "";
      await streamImage("/api/generate-image", sheetPrompt(c), (url, final) => {
        last = url;
        setPreview({ id: c.id, url, final });
      });
      patch(c.id, { imageUrl: last });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Character sheet generation failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-widest text-accent">Character sheet</span>
            <h2 className="text-lg font-semibold">Keep your cast consistent across frames</h2>
          </div>
          <button
            onClick={() =>
              onChange([
                ...board.characters,
                {
                  id: uid(),
                  name: "New character",
                  description: "",
                  wardrobe: "",
                  props: "",
                  prompt: "",
                  imageUrl: null,
                },
              ])
            }
            className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium"
          >
            + Add character
          </button>
        </div>

        {board.characters.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No characters yet. Add one to inject into every image prompt.
          </p>
        )}

        {board.characters.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div className="aspect-[3/4] rounded-lg overflow-hidden border border-dashed border-border bg-muted/30 grid place-items-center">
                {preview?.id === c.id ? (
                  <img
                    src={preview.url}
                    alt=""
                    className={
                      "w-full h-full object-cover transition " +
                      (preview.final ? "blur-0" : "blur-md")
                    }
                  />
                ) : c.imageUrl ? (
                  <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="px-2 text-center text-[10px] text-muted-foreground">
                    No sheet yet
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <textarea
                  rows={4}
                  placeholder="Character sheet prompt (leave blank to auto-build)"
                  className="sb-input"
                  value={c.prompt ?? ""}
                  onChange={(e) => patch(c.id, { prompt: e.target.value })}
                />
                <button
                  onClick={() => generateSheet(c)}
                  disabled={busyId === c.id}
                  className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {busyId === c.id ? "Generating sheet…" : "Generate character sheet"}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                className="sb-input font-medium"
                value={c.name}
                onChange={(e) => patch(c.id, { name: e.target.value })}
              />
              <button
                onClick={() => onChange(board.characters.filter((x) => x.id !== c.id))}
                className="text-xs text-destructive hover:underline shrink-0"
              >
                Remove
              </button>
            </div>
            <textarea
              rows={2}
              placeholder="Description"
              className="sb-input"
              value={c.description}
              onChange={(e) => patch(c.id, { description: e.target.value })}
            />
            <input
              placeholder="Wardrobe"
              className="sb-input"
              value={c.wardrobe}
              onChange={(e) => patch(c.id, { wardrobe: e.target.value })}
            />
            <input
              placeholder="Signature props"
              className="sb-input"
              value={c.props}
              onChange={(e) => patch(c.id, { props: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
