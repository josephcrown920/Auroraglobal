// Video Agent store — localStorage-backed video project persistence.
// Tracks projects from prompt → script → scenes → export.

export type VideoStyle = "cinematic" | "minimal" | "vibrant" | "documentary";
export type VideoVoice = "narrator-deep" | "narrator-warm" | "news-anchor" | "conversational";
export type VideoStatus =
  | "creating"
  | "scripting"
  | "visuals"
  | "voiceover"
  | "compiling"
  | "editing"
  | "exported"
  | "failed";

export type VideoScene = {
  id: string;
  index: number;
  title: string;
  script: string;
  description: string;
  duration: number;
  frame: string | null;
  frameStatus: "idle" | "loading" | "done" | "error";
  voiceoverStatus: "idle" | "loading" | "done" | "error";
};

export type VideoProject = {
  id: string;
  prompt: string;
  title: string;
  style: VideoStyle;
  voice: VideoVoice;
  targetDuration: number;
  scenes: VideoScene[];
  status: VideoStatus;
  statusMessage: string;
  createdAt: number;
  updatedAt: number;
  exportUrl: string | null;
  thumbnailUrl: string | null;
};

const STORE_KEY = "aurora.video-projects.v2";

function read(): VideoProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as VideoProject[]) : [];
  } catch {
    return [];
  }
}

function write(projects: VideoProject[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error("video-agent-store write failed", err);
  }
}

export const videoAgentStore = {
  list: (): VideoProject[] => read(),
  get: (id: string): VideoProject | undefined => read().find((p) => p.id === id),
  create: (project: VideoProject) => {
    const all = read().filter((p) => p.id !== project.id);
    write([project, ...all]);
    return project;
  },
  update: (id: string, patch: Partial<VideoProject>) => {
    const all = read().map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p));
    write(all);
    return all.find((p) => p.id === id);
  },
  updateScene: (projectId: string, sceneId: string, patch: Partial<VideoScene>) => {
    const all = read().map((p) => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        scenes: p.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)),
      };
    });
    write(all);
    return all.find((p) => p.id === projectId);
  },
  remove: (id: string) => write(read().filter((p) => p.id !== id)),
  clear: () => write([]),
};

export const styleLabels: Record<VideoStyle, string> = {
  cinematic: "Cinematic",
  minimal: "Minimal",
  vibrant: "Vibrant",
  documentary: "Documentary",
};

export const styleDescriptions: Record<VideoStyle, string> = {
  cinematic: "Anamorphic lenses, film grain, teal-orange grade",
  minimal: "Clean white space, subtle motion, modern typography",
  vibrant: "Bold colors, dynamic cuts, energetic pacing",
  documentary: "Natural light, handheld feel, authentic moments",
};

export const voiceLabels: Record<VideoVoice, string> = {
  "narrator-deep": "Narrator — Deep",
  "narrator-warm": "Narrator — Warm",
  "news-anchor": "News Anchor",
  conversational: "Conversational",
};

export const vaUid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
