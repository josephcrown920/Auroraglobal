// Aurora MCP — shared types.
// The avatar row mirrors the per-user `avatars` table (see migration
// *_aurora_mcp_avatars.sql). Generation goes through the app's real
// synchronous /api/public/generate endpoint, so there is no async job model
// here for single items; bulk jobs use the existing public.jobs queue.

export type VideoModel =
  | "kling-2.5"
  | "kling-2.5-turbo"
  | "kling-2.0"
  | "heygen-v2"
  | "wan-2.1"
  | "hailuo-v2"
  | "sora-turbo";

export type ImageModel =
  | "kling-kolors"
  | "seedream-4"
  | "nano-banana-pro";

export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export interface Avatar {
  id: string;
  user_id: string;
  name: string;
  handle: string;
  lora_id: string | null;
  sync_lora_id: string | null;
  trigger_word: string | null;
  style: string | null;
  preview_url: string | null;
  training_status: "pending" | "in_progress" | "completed" | "failed";
  training_submitted_at: string | null;
  training_completed_at: string | null;
  training_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelSelection {
  model: VideoModel | ImageModel;
  reason: string;
  estimatedCredits: number;
}

// MCP tool result envelope (matches the MCP `tools/call` result shape).
export interface ToolContent {
  type: "text";
  text: string;
}
export type ToolResult = { content: ToolContent[]; isError?: boolean };
