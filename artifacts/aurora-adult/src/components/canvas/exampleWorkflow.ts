// Pre-built example workflow shown when the Canvas opens for the first time —
// "one influencer turned into a whole content drop" (see onboarding tour).
// Uses the model's own reference photos as placeholders for the two branches
// so the lineage is visible immediately without spending Aura on load.
import { MODELS, LOOKS } from "@/lib/models";
import type { ShotNode, CanvasEdge } from "./types";

// The seeded example workflow's cards must stay fully interactive — same
// branch/regenerate/make-video actions as any card the user creates — or the
// tour's promises ("branch from any shot", "turn a shot into video") are lies.
export interface ExampleWorkflowHandlers {
  onBranch: (nodeId: string) => void;
  onRegenerate: (nodeId: string) => void;
  onMakeVideo: (nodeId: string) => void;
}

function frame(
  id: string,
  x: number,
  y: number,
  label: string,
  mediaUrl: string,
  handlers: ExampleWorkflowHandlers,
  mediaType: "image" | "video" = "image",
): ShotNode {
  return {
    id,
    type: "shot",
    position: { x, y },
    data: {
      label,
      mediaUrl,
      mediaType,
      status: "done",
      prompt: label,
      modelId: MODELS[0].id,
      onBranch: handlers.onBranch,
      onRegenerate: handlers.onRegenerate,
      onMakeVideo: handlers.onMakeVideo,
    },
  };
}

export function buildExampleWorkflow(handlers: ExampleWorkflowHandlers): { nodes: ShotNode[]; edges: CanvasEdge[] } {
  const model = MODELS[0];
  const root = frame("ex-root", 0, 120, `${model.name} · Reference`, model.photos[0], handlers);

  const rowA = [
    frame("ex-a1", 220, 0, "Golden Hour", model.cover, handlers),
    frame("ex-a2", 440, 0, LOOKS[2].label, model.photos[1] ?? model.cover, handlers),
    frame("ex-a3", 660, 0, "Beach location", model.cover, handlers),
    frame("ex-a4", 880, 0, "Video output", model.cover, handlers, "video"),
  ];
  const rowB = [
    frame("ex-b1", 220, 260, "Velvet", model.photos[1] ?? model.cover, handlers),
    frame("ex-b2", 440, 260, "Luxury Suite", model.cover, handlers),
    frame("ex-b3", 660, 260, "Golden hour outfit", model.photos[1] ?? model.cover, handlers),
    frame("ex-b4", 880, 260, "Video output", model.cover, handlers, "video"),
  ];

  const nodes = [root, ...rowA, ...rowB];
  const chain = (ids: string[]) =>
    ids.slice(0, -1).map((id, i) => ({
      id: `e-${id}-${ids[i + 1]}`,
      source: id,
      target: ids[i + 1],
      animated: true,
      style: { strokeDasharray: "4 4", stroke: "#e11d6a55" },
    }));

  const edges: CanvasEdge[] = [
    { id: "e-root-a1", source: "ex-root", target: "ex-a1", animated: true, style: { strokeDasharray: "4 4", stroke: "#e11d6a55" } },
    { id: "e-root-b1", source: "ex-root", target: "ex-b1", animated: true, style: { strokeDasharray: "4 4", stroke: "#e11d6a55" } },
    ...chain(rowA.map((n) => n.id)),
    ...chain(rowB.map((n) => n.id)),
  ];

  return { nodes, edges };
}
