import type { Node, Edge } from "@xyflow/react";

export type ShotStatus = "generating" | "done" | "failed";
/** What a node actually renders as. */
export type MediaKind = "image" | "video";
/** What generation kind was requested — upscale still renders as an image. */
export type GenKind = "image" | "video" | "upscale";

export interface ShotNodeData extends Record<string, unknown> {
  label: string;
  mediaUrl: string | null;
  mediaType: MediaKind;
  status: ShotStatus;
  prompt: string;
  modelId: string;
  lookId?: string;
  error?: string;
  /** Wired in by CanvasWorkspace so the node can trigger canvas-level actions. */
  onBranch: (nodeId: string) => void;
  onRegenerate: (nodeId: string) => void;
  onMakeVideo: (nodeId: string) => void;
}

export type ShotNode = Node<ShotNodeData, "shot">;
export type CanvasEdge = Edge;
