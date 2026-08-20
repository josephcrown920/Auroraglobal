/**
 * STORYBOARD SEQUENCING
 *
 * Layers are shots. Every layer carries an explicit `order`, so the stack is a
 * real sequence you can reorder, insert into and renumber — not just an array
 * whose meaning depends on push order.
 */

export type Shot = {
  id: string;
  /** 1-based position in the sequence. Always contiguous after `sequence()`. */
  order: number;
  prompt: string;
  dataUrl: string;
  /** Story beat for this shot. */
  beat?: string;
  /** Motion direction handed to a video engine. */
  motion?: string;
  /** Bible version this shot was rendered against (drives retro-update). */
  bibleVersion?: number;
};

export function sequence(shots: Shot[]): Shot[] {
  return [...shots]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((shot, index) => ({ ...shot, order: index + 1 }));
}

export function nextOrder(shots: Shot[]) {
  return shots.reduce((max, shot) => Math.max(max, shot.order ?? 0), 0) + 1;
}

export function appendShot(shots: Shot[], shot: Omit<Shot, "order">): Shot[] {
  return sequence([...shots, { ...shot, order: nextOrder(shots) }]);
}

/** Replace-in-place on re-render (streaming frames), preserving position. */
export function upsertShot(shots: Shot[], shot: Omit<Shot, "order"> & { order?: number }): Shot[] {
  const existing = shots.find((s) => s.id === shot.id);
  if (existing) {
    return sequence(shots.map((s) => (s.id === shot.id ? { ...existing, ...shot, order: existing.order } : s)));
  }
  return appendShot(shots, shot);
}

export function moveShot(shots: Shot[], id: string, direction: -1 | 1): Shot[] {
  const ordered = sequence(shots);
  const index = ordered.findIndex((s) => s.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= ordered.length) return ordered;
  const next = [...ordered];
  const a = next[index];
  const b = next[target];
  if (!a || !b) return ordered;
  next[index] = b;
  next[target] = a;
  return sequence(next.map((shot, i) => ({ ...shot, order: i + 1 })));
}

export function removeShot(shots: Shot[], id: string): Shot[] {
  return sequence(shots.filter((s) => s.id !== id));
}

export function patchShot(shots: Shot[], id: string, patch: Partial<Shot>): Shot[] {
  return sequence(shots.map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

export function shotCode(order: number) {
  return `SH${String(order).padStart(2, "0")}`;
}

/** Shots rendered against an older bible version need a retro-update. */
export function staleShots(shots: Shot[], bibleVersion: number) {
  return sequence(shots).filter((s) => (s.bibleVersion ?? 0) < bibleVersion);
}

/** A readable shot list — used by the agent and by the ZIP recipe. */
export function buildSequencePrompt(shots: Shot[], identityGraph = "", voice = ""): string {
  const ordered = sequence(shots);
  return [
    identityGraph,
    voice,
    identityGraph || voice ? "" : null,
    "SHOT SEQUENCE:",
    ...ordered.map((shot) =>
      [
        `${shotCode(shot.order)}${shot.beat?.trim() ? ` — ${shot.beat.trim()}` : ""}`,
        `  frame: ${shot.prompt.trim()}`,
        shot.motion?.trim() ? `  motion: ${shot.motion.trim()}` : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    ),
  ]
    .filter((line): line is string => line !== null && line !== "")
    .join("\n");
}
