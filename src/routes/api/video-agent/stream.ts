// POST /api/video-agent/stream
// Stable SSE endpoint for Video Agent assistant responses.
// ModelArk streams upstream token deltas; Aurora wraps them as start/delta/usage/done/error events.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { assertRateLimit, RateLimitError } from "@/lib/rate-limit.server";
import { modelArkTextModel } from "@/lib/modelark.server";
import { streamModelArkText, wrapModelArkSSE, hasModelArkStreaming, type ModelArkStreamMessage } from "@/lib/modelark-stream.server";

const Schema = z.object({
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.unknown() })).min(1).max(100),
  model: z.string().min(1).max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(32768).optional(),
});

const STREAM_RATE_WINDOW_MS = 60_000;
const STREAM_RATE_MAX_PER_WINDOW = 15;

function normalizeRequestedModel(model?: string): string | undefined {
  const val = model?.trim();
  if (!val) return undefined;
  return val.replace(/\/+$/, "");
}

function resolveAllowedModel(requestedModel?: string): string {
  const configured = modelArkTextModel();
  const normalized = normalizeRequestedModel(requestedModel);
  const allowed = new Set([
    configured,
    configured.replace(/.*\//, ""),
    "dola-seed-2-1-turbo-260628",
    "dola-seed-2-1-turbo",
    "dola-seed-2-0-lite",
    "dola-seed-2-0-mini",
    "deepseek-v4-flash-ga-260731",
    "deepseek-v4-flash",
  ]);
  if (!normalized) return configured;
  if (!allowed.has(normalized)) {
    throw new Error(`Unsupported ModelArk model for this endpoint: ${normalized}`);
  }
  return normalized;
}

async function authUserId(request: Request): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const h = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const token = h.slice(7);
  if (token.startsWith("aurk_")) {
    const { userIdForApiKey } = await import("@/lib/cli-device.server");
    return userIdForApiKey(token);
  }
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

export const Route = createFileRoute("/api/video-agent/stream")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }}),
      POST: async ({ request }) => {
        const userId = await authUserId(request);
        if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        try {
          assertRateLimit(`video-agent-stream:${userId}`, STREAM_RATE_MAX_PER_WINDOW, STREAM_RATE_WINDOW_MS);
        } catch (error) {
          if (error instanceof RateLimitError) {
            return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 429, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
          }
          throw error;
        }
        if (!hasModelArkStreaming()) return new Response(JSON.stringify({ error: "ModelArk streaming is not configured", required: ["ARK_API_KEY or BYTEPLUS_API_KEY", "MODELARK_TEXT_MODEL"] }), { status: 503, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        try {
          const input = Schema.parse(await request.json());
          const model = resolveAllowedModel(input.model);
          const upstream = await streamModelArkText({ messages: input.messages as ModelArkStreamMessage[], model, temperature: input.temperature, maxTokens: input.maxTokens, signal: request.signal });
          return wrapModelArkSSE(upstream, request.signal);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status = message.includes("Unsupported ModelArk model") ? 403 : 500;
          return new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }
      },
    },
  },
});
