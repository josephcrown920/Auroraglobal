import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { listUnifiedCapabilities } from "./comfy-manager.integration.server";
import { planVideoAgent, generateVideoAgent, type VideoAgentMode } from "./byteplus-agent.integration.server";

export const getUnifiedComfyCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => listUnifiedCapabilities());

const videoAgentInput = z.object({
  prompt: z.string().min(1).max(20_000),
  mode: z.enum(["standard", "cinematic", "viral"]).optional(),
  preset: z.string().max(120).optional(),
  workflowId: z.string().max(120).optional(),
  imageUrls: z.array(z.string().url()).max(8).optional(),
  model: z.string().max(160).optional(),
  duration: z.number().positive().max(60).optional(),
  resolution: z.string().max(32).optional(),
  aspectRatio: z.string().max(16).optional(),
});

export const planUnifiedVideoAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => videoAgentInput.parse(data))
  .handler(async ({ data }) => planVideoAgent(data));

export const runUnifiedVideoAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => videoAgentInput.parse(data))
  .handler(async ({ data, context }) => {
    const result = await generateVideoAgent(data);
    return { ...result, userId: context.userId };
  });

export type UnifiedVideoAgentMode = VideoAgentMode;
