/**
 * CHARACTER BIBLE — a persistent identity graph for an artist.
 *
 * This is not a face lock. A bible stores every component of a person's look
 * (face, body, hair, wardrobe pieces, jewelry, tattoos, voice) as individually
 * addressable, lockable traits, and versions the whole graph over time so any
 * engine renders the same person — and past shoots can be retro-updated when
 * the artist changes their look.
 */

export const TRAIT_KINDS = [
  "face",
  "body",
  "hair",
  "wardrobe",
  "jewelry",
  "tattoo",
  "voice",
] as const;

export type TraitKind = (typeof TRAIT_KINDS)[number];

export type BibleTrait = {
  id: string;
  kind: TraitKind;
  label: string;
  detail: string;
  /** Locked traits are enforced in every render; unlocked ones are suggestions. */
  locked: boolean;
  imageDataUrl?: string;
};

export type BibleVersion = {
  version: number;
  createdAt: number;
  note: string;
  traits: BibleTrait[];
};

export type CharacterBible = {
  id: string;
  name: string;
  alias: string;
  version: number;
  traits: BibleTrait[];
  versions: BibleVersion[];
  notes: string;
  createdAt: number;
  updatedAt: number;
};

const KEY = "aurora.character-bibles.v1";
const ACTIVE_KEY = "aurora.character-bible.active";

const KIND_LABEL: Record<TraitKind, string> = {
  face: "FACE",
  body: "BODY",
  hair: "HAIR",
  wardrobe: "WARDROBE",
  jewelry: "JEWELRY",
  tattoo: "TATTOOS",
  voice: "VOICE",
};

export function traitKindLabel(kind: TraitKind) {
  return KIND_LABEL[kind];
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}`;
}

export function createTrait(kind: TraitKind, label = "", detail = ""): BibleTrait {
  return { id: uid(), kind, label, detail, locked: true };
}

export function createBible(name = "New artist"): CharacterBible {
  const now = Date.now();
  return {
    id: uid(),
    name,
    alias: "",
    version: 1,
    notes: "",
    createdAt: now,
    updatedAt: now,
    traits: [
      createTrait("face", "Face", ""),
      createTrait("body", "Body", ""),
      createTrait("hair", "Hair", ""),
      createTrait("wardrobe", "Signature fit", ""),
      createTrait("jewelry", "Chain", ""),
      createTrait("tattoo", "Tattoos", ""),
      createTrait("voice", "Voice / delivery", ""),
    ],
    versions: [],
  };
}

function safeParse(raw: string | null): CharacterBible[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? (value as CharacterBible[]) : [];
  } catch {
    return [];
  }
}

export function loadBibles(): CharacterBible[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(KEY)).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveBible(bible: CharacterBible): CharacterBible[] {
  const next = [{ ...bible, updatedAt: Date.now() }, ...loadBibles().filter((b) => b.id !== bible.id)];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    const trimmed = next.slice(0, 3);
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    return trimmed;
  }
  return next;
}

export function deleteBible(id: string): CharacterBible[] {
  const next = loadBibles().filter((b) => b.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function loadActiveBibleId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveBibleId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_KEY);
}

/** Snapshot the current graph and bump the version — the retro-update anchor. */
export function commitVersion(bible: CharacterBible, note: string): CharacterBible {
  const snapshot: BibleVersion = {
    version: bible.version,
    createdAt: Date.now(),
    note: note.trim() || `v${bible.version} snapshot`,
    traits: bible.traits.map((t) => ({ ...t })),
  };
  return {
    ...bible,
    version: bible.version + 1,
    versions: [snapshot, ...bible.versions].slice(0, 24),
    updatedAt: Date.now(),
  };
}

export function restoreVersion(bible: CharacterBible, version: number): CharacterBible {
  const found = bible.versions.find((v) => v.version === version);
  if (!found) return bible;
  return {
    ...bible,
    traits: found.traits.map((t) => ({ ...t, id: uid() })),
    version: bible.version + 1,
    versions: [
      { version: bible.version, createdAt: Date.now(), note: `restored v${version}`, traits: bible.traits },
      ...bible.versions,
    ].slice(0, 24),
    updatedAt: Date.now(),
  };
}

export function upsertTrait(bible: CharacterBible, trait: BibleTrait): CharacterBible {
  const exists = bible.traits.some((t) => t.id === trait.id);
  return {
    ...bible,
    traits: exists ? bible.traits.map((t) => (t.id === trait.id ? trait : t)) : [...bible.traits, trait],
    updatedAt: Date.now(),
  };
}

export function removeTrait(bible: CharacterBible, id: string): CharacterBible {
  return { ...bible, traits: bible.traits.filter((t) => t.id !== id), updatedAt: Date.now() };
}

export function filledTraits(bible: CharacterBible) {
  return bible.traits.filter((t) => t.detail.trim().length > 0);
}

/** Percentage of the graph that is actually described — drives the UI meter. */
export function bibleCompleteness(bible: CharacterBible) {
  if (bible.traits.length === 0) return 0;
  return Math.round((filledTraits(bible).length / bible.traits.length) * 100);
}

/** Reference frames the bible contributes to a render (face frames first). */
export function bibleReferenceImages(bible: CharacterBible): string[] {
  const order: TraitKind[] = ["face", "hair", "body", "jewelry", "tattoo", "wardrobe", "voice"];
  return bible.traits
    .filter((t) => Boolean(t.imageDataUrl))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((t) => t.imageDataUrl as string);
}

/**
 * Compile the identity graph into an engine-agnostic contract. The same text is
 * injected regardless of which image engine is selected, which is what keeps a
 * person consistent when you switch models.
 */
export function compileIdentityGraph(bible: CharacterBible): string {
  const traits = filledTraits(bible).filter((t) => t.kind !== "voice");
  if (traits.length === 0) return "";
  const grouped = TRAIT_KINDS.filter((kind) => kind !== "voice")
    .map((kind) => {
      const lines = traits.filter((t) => t.kind === kind);
      if (lines.length === 0) return null;
      return `${KIND_LABEL[kind]}: ${lines
        .map((t) => `${t.label.trim() || kind}${t.locked ? " [LOCKED]" : ""} — ${t.detail.trim()}`)
        .join("; ")}`;
    })
    .filter((line): line is string => Boolean(line));

  return [
    `CHARACTER BIBLE — ${bible.name.trim() || "artist"}${bible.alias.trim() ? ` (${bible.alias.trim()})` : ""} · v${bible.version}`,
    "Render this exact person. Every [LOCKED] trait below is non-negotiable and must be reproduced faithfully in the output, regardless of which engine renders it.",
    ...grouped,
    bible.notes.trim() ? `NOTES: ${bible.notes.trim()}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

/** Voice traits do not affect image renders — they travel with motion/audio work. */
export function compileVoiceProfile(bible: CharacterBible): string {
  const voice = bible.traits.filter((t) => t.kind === "voice" && t.detail.trim());
  if (voice.length === 0) return "";
  return `VOICE: ${voice.map((t) => `${t.label.trim() || "voice"} — ${t.detail.trim()}`).join("; ")}`;
}
