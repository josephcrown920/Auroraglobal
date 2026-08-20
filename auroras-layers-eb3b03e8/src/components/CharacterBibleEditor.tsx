import { useEffect, useRef, useState } from "react";
import {
  TRAIT_KINDS,
  bibleCompleteness,
  commitVersion,
  createTrait,
  deleteBible,
  removeTrait,
  restoreVersion,
  traitKindLabel,
  upsertTrait,
  type BibleTrait,
  type TraitKind,
} from "@/lib/characterBible";
import { useBibles } from "@/lib/bibleStore";
import { onStudioCommand } from "@/lib/studioBus";

/**
 * CHARACTER BIBLE — the identity graph editor.
 * Not a face lock: every component of a person's look is an addressable,
 * lockable trait, versioned over time so past shoots can be retro-updated.
 */
export function CharacterBibleEditor() {
  const { bibles, active, persist, activate, create, refresh } = useBibles();
  const [note, setNote] = useState("");
  const [pendingKind, setPendingKind] = useState<TraitKind>("wardrobe");
  const uploadRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  useEffect(
    () =>
      onStudioCommand((command) => {
        if (command.type !== "bible") return;
        const target = active ?? create("New artist");
        const kind = (TRAIT_KINDS as readonly string[]).includes(command.kind)
          ? (command.kind as TraitKind)
          : "wardrobe";
        const existing = target.traits.find(
          (t) => t.kind === kind && t.label.toLowerCase() === command.label.toLowerCase(),
        );
        const trait: BibleTrait = existing
          ? { ...existing, detail: command.detail }
          : { ...createTrait(kind, command.label, command.detail) };
        persist(upsertTrait(target, trait));
      }),
    [active, create, persist],
  );

  function patch(trait: BibleTrait) {
    if (!active) return;
    persist(upsertTrait(active, trait));
  }

  function onUpload(file: File | undefined) {
    if (!file || !active || !uploadTarget) return;
    const trait = active.traits.find((t) => t.id === uploadTarget);
    if (!trait) return;
    const reader = new FileReader();
    reader.onload = () => patch({ ...trait, imageDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label-chip">Character bible</span>
        <select
          value={active?.id ?? ""}
          onChange={(e) => activate(e.target.value || null)}
          className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-xs outline-none focus:border-primary"
        >
          <option value="">No artist locked</option>
          {bibles.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · v{b.version}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => create()}
          className="rounded-full border border-border px-3 py-1.5 text-[0.65rem] tracking-wider uppercase hover:border-primary hover:text-primary"
        >
          New artist
        </button>
      </div>

      {!active ? (
        <p className="mt-4 text-sm text-muted-foreground">
          A bible stores a person — face, body, hair, wardrobe, jewelry, tattoos, voice — as
          individually lockable traits, versioned over time. Lock one and every engine renders the
          same artist.
        </p>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <input
              value={active.name}
              onChange={(e) => persist({ ...active, name: e.target.value })}
              placeholder="Artist name"
              className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={active.alias}
              onChange={(e) => persist({ ...active, alias: e.target.value })}
              placeholder="Alias / stage name"
              className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[0.65rem] tracking-[0.25em] text-muted-foreground uppercase">
              <span>Identity graph · v{active.version}</span>
              <span>{bibleCompleteness(active)}% described</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-[width] duration-500"
                style={{ width: `${bibleCompleteness(active)}%` }}
              />
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {active.traits.map((trait) => (
              <li key={trait.id} className="rounded-xl border border-border bg-secondary/30 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-mono-ui)] text-[0.6rem] tracking-[0.2em] text-accent uppercase">
                    {traitKindLabel(trait.kind)}
                  </span>
                  <input
                    value={trait.label}
                    onChange={(e) => patch({ ...trait, label: e.target.value })}
                    placeholder="Label"
                    className="flex-1 rounded bg-transparent px-1 text-xs font-bold outline-none focus:bg-secondary"
                  />
                  <button
                    type="button"
                    onClick={() => patch({ ...trait, locked: !trait.locked })}
                    className={
                      trait.locked
                        ? "rounded-full bg-primary px-2 py-0.5 text-[0.6rem] font-bold tracking-wider text-primary-foreground uppercase"
                        : "rounded-full border border-border px-2 py-0.5 text-[0.6rem] tracking-wider text-muted-foreground uppercase"
                    }
                  >
                    {trait.locked ? "locked" : "free"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadTarget(trait.id);
                      uploadRef.current?.click();
                    }}
                    className="text-[0.6rem] tracking-wider text-muted-foreground uppercase hover:text-primary"
                  >
                    {trait.imageDataUrl ? "ref ✓" : "+ ref"}
                  </button>
                  <button
                    type="button"
                    onClick={() => persist(removeTrait(active, trait.id))}
                    className="text-[0.6rem] tracking-wider text-muted-foreground uppercase hover:text-destructive"
                  >
                    del
                  </button>
                </div>
                <textarea
                  value={trait.detail}
                  onChange={(e) => patch({ ...trait, detail: e.target.value })}
                  rows={2}
                  placeholder={`Describe the ${trait.kind}…`}
                  className="mt-2 w-full resize-none rounded-lg bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                />
              </li>
            ))}
          </ul>
          <input
            ref={uploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0])}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={pendingKind}
              onChange={(e) => setPendingKind(e.target.value as TraitKind)}
              className="rounded-lg border border-border bg-secondary px-2 py-1.5 text-[0.7rem] outline-none focus:border-primary"
            >
              {TRAIT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {traitKindLabel(kind)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => persist(upsertTrait(active, createTrait(pendingKind)))}
              className="rounded-full border border-border px-3 py-1.5 text-[0.65rem] tracking-wider uppercase hover:border-primary hover:text-primary"
            >
              + Add trait
            </button>
          </div>

          <div className="mt-4 border-t border-border pt-4">
            <div className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What changed? (e.g. cut the locs, new grillz)"
                className="flex-1 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => {
                  persist(commitVersion(active, note));
                  setNote("");
                }}
                className="btn-aurora rounded-full px-4 py-2 text-[0.65rem] font-bold tracking-wider uppercase"
              >
                Commit v{active.version + 1}
              </button>
            </div>
            {active.versions.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {active.versions.map((v) => (
                  <li key={`${v.version}-${v.createdAt}`} className="flex items-center gap-2 text-xs">
                    <span className="font-[family-name:var(--font-mono-ui)] text-accent">v{v.version}</span>
                    <span className="flex-1 truncate text-muted-foreground">{v.note}</span>
                    <button
                      type="button"
                      onClick={() => persist(restoreVersion(active, v.version))}
                      className="text-[0.6rem] tracking-wider uppercase hover:text-primary"
                    >
                      restore
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <button
              type="button"
              onClick={() => {
                deleteBible(active.id);
                activate(null);
                refresh();
              }}
              className="mt-3 text-[0.6rem] tracking-wider text-muted-foreground uppercase hover:text-destructive"
            >
              Delete artist
            </button>
          </div>
        </>
      )}
    </div>
  );
}
