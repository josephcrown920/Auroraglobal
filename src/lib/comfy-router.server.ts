/**
 * Server-only Comfy Router adapter.
 *
 * Comfy Router provides one API surface for supported frontier media models.
 * Aurora keeps provider selection explicit and does not silently bypass
 * provider-specific safety/identity requirements.
 */

import { comfy } from "@comfyorg/sdk";

export type ComfyRouterRun = {
  model: string;
  input: Record<string, unknown>;
  provider?: string;
};

export async function runComfyRouterModel(request: ComfyRouterRun) {
  const apiKey = process.env.COMFY_API_KEY;
  if (!apiKey) throw new Error("Comfy Router is not configured: COMFY_API_KEY is missing");

  comfy.config({
    credentials: apiKey,
    ...(process.env.COMFY_ROUTER_BASE_URL
      ? { baseUrl: process.env.COMFY_ROUTER_BASE_URL }
      : {}),
  });

  return comfy.models.run(request.model, {
    ...request.input,
    ...(request.provider ? { model_provider: request.provider } : {}),
  });
}

export async function listComfyRouterModels() {
  const apiKey = process.env.COMFY_API_KEY;
  if (!apiKey) throw new Error("Comfy Router is not configured: COMFY_API_KEY is missing");

  comfy.config({
    credentials: apiKey,
    ...(process.env.COMFY_ROUTER_BASE_URL
      ? { baseUrl: process.env.COMFY_ROUTER_BASE_URL }
      : {}),
  });

  return comfy.models.list();
}
