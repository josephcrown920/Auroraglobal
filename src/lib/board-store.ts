import { useCallback, useEffect, useState } from "react";
import { shots as sampleShots } from "@/features/storyboard/shots";

export type ShotNode = {
  id: string;
  kind?: "shot" | "video";
  title: string;
  scene: string;
  shotType: string;
  frame: string;
  wardrobe: string;
  mood: string;
  note: string;
  prompt: string;
  imageUrl: string | null;
  videoPrompt?: string;
  videoModel?: string;
  jobId?: string | null;
  videoUrl?: string | null;
  duration: number;
  x: number;
  y: number;
};

export type Edge = { id: string; from: string; to: string };

export type Character = {
  id: string;
  name: string;
  description: string;
  wardrobe: string;
  props: string;
  prompt?: string;
  imageUrl?: string | null;
};

export type Board = {
  id: string;
  title: string;
  treatment: string;
  stylePreset: string;
  shots: ShotNode[];
  edges: Edge[];
  characters: Character[];
  updatedAt: string;
};

export const STORAGE_KEY = "storyboard-studio-board-v1";

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyShot(partial: Partial<ShotNode> = {}): ShotNode {
  return {
    id: uid(),
    kind: "shot",
    title: "New shot",
    scene: "Verse",
    shotType: "",
    frame: "",
    wardrobe: "",
    mood: "",
    note: "",
    prompt: "",
    imageUrl: null,
    videoPrompt: "",
    videoModel: "seedance-2.5",
    jobId: null,
    videoUrl: null,
    duration: 4,
    x: 80,
    y: 80,
    ...partial,
  };
}

const SCENES = [
  "Intro",
  "Intro",
  "Verse",
  "Chorus",
  "Verse",
  "Bridge",
  "Verse",
  "Chorus",
  "Bridge",
  "Outro",
];

export function seedBoard(): Board {
  const nodes = sampleShots.map((s, i) =>
    emptyShot({
      id: `seed-${s.id}`,
      title: s.title,
      scene: SCENES[i] ?? "Verse",
      shotType: s.type,
      frame: s.frame,
      wardrobe: s.wardrobe,
      mood: s.mood,
      note: s.note,
      prompt: `${s.title}. ${s.frame}. Wardrobe: ${s.wardrobe}. Mood: ${s.mood}.`,
      imageUrl: s.image,
      duration: 4,
      x: 60 + (i % 4) * 320,
      y: 60 + Math.floor(i / 4) * 300,
    }),
  );
  const edges: Edge[] = nodes.slice(0, -1).map((n, i) => ({
    id: uid(),
    from: n.id,
    to: nodes[i + 1].id,
  }));
  return {
    id: uid(),
    title: "My first storyboard",
    treatment: "Neon Miami night, streetwear fashion, high-contrast performance energy.",
    stylePreset: "miami-neon",
    shots: nodes,
    edges,
    characters: [
      {
        id: uid(),
        name: "The Artist",
        description: "Lead performer, confident, camera-aware.",
        wardrobe: "Puffer jackets, layered chains, signature red shades",
        props: "Diamond pendant, pink microphone",
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

function load(): Board {
  if (typeof window === "undefined") return seedBoard();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedBoard();
    const parsed = JSON.parse(raw) as Board;
    if (!parsed?.shots) return seedBoard();
    return parsed;
  } catch {
    return seedBoard();
  }
}

/** Chain order: follow the node graph from its start node(s), left-to-right fallback. */
export function chainOrder(board: Board): ShotNode[] {
  const byId = new Map(board.shots.map((s) => [s.id, s]));
  const incoming = new Set(board.edges.map((e) => e.to));
  const next = new Map<string, string>();
  for (const e of board.edges) if (!next.has(e.from)) next.set(e.from, e.to);

  const starts = board.shots.filter((s) => !incoming.has(s.id)).sort((a, b) => a.x - b.x);
  const seen = new Set<string>();
  const out: ShotNode[] = [];
  for (const start of starts) {
    let cur: string | undefined = start.id;
    while (cur && !seen.has(cur)) {
      const node = byId.get(cur);
      if (!node) break;
      seen.add(cur);
      out.push(node);
      cur = next.get(cur);
    }
  }
  for (const s of [...board.shots].sort((a, b) => a.x - b.x)) {
    if (!seen.has(s.id)) out.push(s);
  }
  return out;
}

export function useBoard() {
  const [board, setBoardState] = useState<Board | null>(null);

  useEffect(() => {
    setBoardState(load());
  }, []);

  const setBoard = useCallback((updater: (b: Board) => Board) => {
    setBoardState((prev) => {
      if (!prev) return prev;
      const next = { ...updater(prev), updatedAt: new Date().toISOString() };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* quota — keep in-memory state */
      }
      return next;
    });
  }, []);

  const updateShot = useCallback(
    (id: string, patch: Partial<ShotNode>) =>
      setBoard((b) => ({
        ...b,
        shots: b.shots.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      })),
    [setBoard],
  );

  const addShot = useCallback(
    (partial: Partial<ShotNode> = {}) => {
      const shot = emptyShot(partial);
      setBoard((b) => {
        const last = chainOrder(b).at(-1);
        const placed: ShotNode = {
          ...shot,
          x: partial.x ?? (last ? last.x + 320 : 60),
          y: partial.y ?? (last ? last.y : 60),
        };
        return {
          ...b,
          shots: [...b.shots, placed],
          edges: last ? [...b.edges, { id: uid(), from: last.id, to: placed.id }] : b.edges,
        };
      });
      return shot.id;
    },
    [setBoard],
  );

  const removeShot = useCallback(
    (id: string) =>
      setBoard((b) => ({
        ...b,
        shots: b.shots.filter((s) => s.id !== id),
        edges: b.edges.filter((e) => e.from !== id && e.to !== id),
      })),
    [setBoard],
  );

  const connect = useCallback(
    (from: string, to: string) =>
      setBoard((b) => {
        if (from === to) return b;
        const exists = b.edges.some((e) => e.from === from && e.to === to);
        if (exists) return b;
        return {
          ...b,
          edges: [
            ...b.edges.filter((e) => e.from !== from && e.to !== to),
            { id: uid(), from, to },
          ],
        };
      }),
    [setBoard],
  );

  const disconnect = useCallback(
    (edgeId: string) => setBoard((b) => ({ ...b, edges: b.edges.filter((e) => e.id !== edgeId) })),
    [setBoard],
  );

  const reset = useCallback(() => {
    const fresh = seedBoard();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      /* ignore */
    }
    setBoardState(fresh);
  }, []);

  return { board, setBoard, updateShot, addShot, removeShot, connect, disconnect, reset };
}

export type BoardApi = ReturnType<typeof useBoard>;
