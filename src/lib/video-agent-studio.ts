import type { Board, ShotNode } from "@/lib/board-store";

export type VideoAgentContext = {
  title: string;
  brief: string;
  audience: string;
  platform: "youtube" | "tiktok" | "instagram" | "commercial" | "music-video" | "custom";
  aspectRatio: string;
  visualStyle: string;
  references: string[];
  mustKeep: string[];
};

export type VideoAgentModelRoute = {
  task: "video" | "image" | "audio" | "lipsync" | "upscale";
  preferred: string;
  fallbacks: string[];
  reason: string;
};

export type VideoAgentProductionPlan = {
  context: VideoAgentContext;
  treatment: string;
  scenes: Array<{
    name: string;
    shots: Array<{
      id: string;
      title: string;
      prompt: string;
      videoPrompt: string;
      model: string;
      duration: number;
      angle: string;
      frame: string;
      mood: string;
      continuity: string;
    }>;
  }>;
  routes: VideoAgentModelRoute[];
};

const DEFAULT_CONTEXT: VideoAgentContext = {
  title: "Untitled Aurora production",
  brief: "",
  audience: "",
  platform: "music-video",
  aspectRatio: "16:9",
  visualStyle: "Cinematic, photoreal, intentional camera movement",
  references: [],
  mustKeep: [],
};

function continuityFor(shot: ShotNode, index: number) {
  const parts = [
    shot.wardrobe && `Wardrobe: ${shot.wardrobe}`,
    shot.mood && `Mood: ${shot.mood}`,
    shot.frame && `Frame: ${shot.frame}`,
  ].filter(Boolean);
  return `${index === 0 ? "Establish visual continuity." : "Match the preceding shot's identity, wardrobe, lighting and environment."}${parts.length ? ` ${parts.join(". ")}.` : ""}`;
}

export function buildVideoAgentPlan(
  board: Board,
  context: Partial<VideoAgentContext> = {},
): VideoAgentProductionPlan {
  const merged = { ...DEFAULT_CONTEXT, ...context };
  const grouped = new Map<string, ShotNode[]>();

  for (const shot of board.shots) {
    const list = grouped.get(shot.scene) ?? [];
    list.push(shot);
    grouped.set(shot.scene, list);
  }

  const scenes = [...grouped.entries()].map(([name, shots]) => ({
    name,
    shots: shots.map((shot, index) => ({
      id: shot.id,
      title: shot.title,
      prompt: shot.prompt,
      videoPrompt: shot.videoPrompt || shot.prompt,
      model: shot.videoModel || "seedance-2.5",
      duration: shot.duration,
      angle: shot.shotType || "cinematic",
      frame: shot.frame,
      mood: shot.mood,
      continuity: continuityFor(shot, index),
    })),
  }));

  return {
    context: merged,
    treatment: board.treatment,
    scenes,
    routes: [
      {
        task: "video",
        preferred: "board-selected model",
        fallbacks: ["Aurora video fallback chain", "self-hosted worker"],
        reason: "Keep model selection per shot while allowing provider failover.",
      },
      {
        task: "image",
        preferred: "Aurora image orchestrator",
        fallbacks: ["free image fallback"],
        reason: "Generate references, storyboard frames and clean plates without changing the production plan.",
      },
      {
        task: "audio",
        preferred: "Aurora audio provider",
        fallbacks: ["configured audio worker"],
        reason: "Keep music, VO and sound-design assets attached to the same production context.",
      },
      {
        task: "lipsync",
        preferred: "self-hosted/RunPod worker",
        fallbacks: ["Colab", "Kaggle", "Hugging Face Space"],
        reason: "Use the existing worker pool so users never need to manage GPU infrastructure.",
      },
      {
        task: "upscale",
        preferred: "configured upscale worker",
        fallbacks: ["ComfyUI worker"],
        reason: "Treat finishing as a production stage rather than a separate app.",
      },
    ],
  };
}

export function serializeProductionPlan(plan: VideoAgentProductionPlan) {
  return JSON.stringify(plan, null, 2);
}
