// Framework-agnostic MCP core: tool manifest + JSON-Schema generation + dispatch.
// Deliberately does NOT use @modelcontextprotocol/sdk — its transports are
// Node-only and won't run on Cloudflare Workers. The HTTP/JSON-RPC plumbing
// lives in src/routes/api/mcp.ts; this module just describes and runs tools.

import { z } from "zod";
import type { ToolResult } from "./types";
import {
  generateVideoSchema, generateVideoTool,
  bulkGenerateSchema, bulkGenerateTool,
  imageToVideoSchema, imageToVideoTool,
  listAvatarsSchema, listAvatarsTool,
  getJobStatusSchema, getJobStatusTool,
  createAvatarSchema, createAvatarTool,
  type ToolCtx,
} from "./tools.server";

interface ToolDef {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
}

const TOOLS: ToolDef[] = [
  {
    name: "aurora_generate_video",
    description:
      "Generate a short AI video with Aurora. A model is auto-selected from the prompt (or pass `model`), and the clip is rendered synchronously — the result URL is returned directly. Optionally attach an Aurora persona via `avatar_name`.",
    schema: generateVideoSchema,
  },
  {
    name: "aurora_bulk_generate",
    description:
      "Batch-queue up to 50 images for a named Aurora persona in one call, automatically varying locations, outfits, moods and lighting. Returns queued job IDs — track them with aurora_get_job_status. Ideal for social campaigns.",
    schema: bulkGenerateSchema,
  },
  {
    name: "aurora_image_to_video",
    description:
      "Animate a still image into a 3–12s video. Provide an image URL and a motion prompt; the rendered video URL is returned directly.",
    schema: imageToVideoSchema,
  },
  {
    name: "aurora_list_avatars",
    description:
      "List the Aurora personas in your account. Use this to discover available names before generating.",
    schema: listAvatarsSchema,
  },
  {
    name: "aurora_get_job_status",
    description:
      "Check the status of a queued generation job (from aurora_bulk_generate) or look up a past generation by id. Returns status, output URL and the model used.",
    schema: getJobStatusSchema,
  },
  {
    name: "aurora_create_avatar",
    description:
      "Create a new Aurora persona. Provide a name (and optional reference image URLs, style, trigger word). LoRA training runs only if HeyGen/Sync keys are configured; otherwise a ready-to-use persona record is created.",
    schema: createAvatarSchema,
  },
];

// ─── Minimal Zod → JSON Schema (enough for MCP tool input schemas) ────────────

function unwrap(field: z.ZodTypeAny): { inner: z.ZodTypeAny; optional: boolean } {
  let f = field;
  let optional = false;
  while (f instanceof z.ZodOptional || f instanceof z.ZodDefault) {
    optional = true;
    f = f instanceof z.ZodOptional ? f.unwrap() : (f as z.ZodDefault<z.ZodTypeAny>)._def.innerType;
  }
  return { inner: f, optional };
}

function jsonType(field: z.ZodTypeAny): Record<string, unknown> {
  if (field instanceof z.ZodString) return { type: "string" };
  if (field instanceof z.ZodNumber) return { type: "number" };
  if (field instanceof z.ZodBoolean) return { type: "boolean" };
  if (field instanceof z.ZodEnum) return { type: "string", enum: field.options };
  if (field instanceof z.ZodArray) return { type: "array", items: jsonType(field.element) };
  return { type: "string" };
}

export function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, field] of Object.entries(shape)) {
    const { inner, optional } = unwrap(field as z.ZodTypeAny);
    const description =
      (field as z.ZodTypeAny)._def?.description ?? (inner as z.ZodTypeAny)._def?.description;
    properties[key] = { ...jsonType(inner), ...(description ? { description } : {}) };
    if (!optional) required.push(key);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
}

export function listTools(): { tools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> } {
  return {
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.schema),
    })),
  };
}

export async function callTool(name: string, args: unknown, ctx: ToolCtx): Promise<ToolResult> {
  switch (name) {
    case "aurora_generate_video":
      return generateVideoTool(generateVideoSchema.parse(args), ctx);
    case "aurora_bulk_generate":
      return bulkGenerateTool(bulkGenerateSchema.parse(args), ctx);
    case "aurora_image_to_video":
      return imageToVideoTool(imageToVideoSchema.parse(args), ctx);
    case "aurora_list_avatars":
      return listAvatarsTool(listAvatarsSchema.parse(args), ctx);
    case "aurora_get_job_status":
      return getJobStatusTool(getJobStatusSchema.parse(args), ctx);
    case "aurora_create_avatar":
      return createAvatarTool(createAvatarSchema.parse(args), ctx);
    default:
      return { content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }], isError: true };
  }
}
