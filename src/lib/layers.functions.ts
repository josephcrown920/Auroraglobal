import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertTrustedUrl } from "@/lib/url-guard";
import { bytePlusLayerize, getBytePlusKey, type LayerizedImageResult } from "@/lib/byteplus.server";

export type LayerProvider = "auto" | "modelark" | "fal-qwen" | "fal-seedream";

export type AuroraLayer = {
  id: string;
  url: string;
  zIndex: number;
  name: string;
  description?: string;
  boundingBox?: {
    absolute?: number[];
    normalized?: number[];
  };
};

export type LayerizeResult = {
  provider: Exclude<LayerProvider, "auto">;
  layerizer: string;
  baseUrl: string;
  layers: AuroraLayer[];
};

const INPUT = z.object({
  imageUrl: z.string().url().max(8_000),
  prompt: z.string().max(2_000).optional().default(""),
  size: z.enum(["auto", "1K", "1.5K", "2K"]).optional().default("auto"),
  provider: z.enum(["auto", "modelark", "fal-qwen", "fal-seedream"]).optional().default("auto"),
});

function normalizeModelArk(result: LayerizedImageResult): LayerizeResult {
  return {
    provider: "modelark",
    layerizer: "Seedream 5.0 Pro Layer Separation (ModelArk)",
    baseUrl: result.baseUrl,
    layers: result.layers.map((layer, index) => ({
      id: `layer-${layer.zIndex}-${index}`,
      url: layer.url,
      zIndex: layer.zIndex,
      name: layer.name,
      description: layer.description,
      boundingBox: layer.boundingBox,
    })),
  };
}

async function falRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not configured. Use ModelArk or add a fal.ai key.");
  const response = await fetch(`https://queue.fal.run/${path}`, {
    ...init,
    headers: {
      Authorization: `Key ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Preserve a useful provider error below.
  }
  if (!response.ok) {
    const detail = typeof json === "object" && json !== null ? JSON.stringify(json) : text;
    throw new Error(`fal.ai ${response.status}: ${detail.slice(0, 500)}`);
  }
  return json as T;
}

type FalSubmit = { request_id?: string };
type FalStatus = { status?: string };
type FalLayer = {
  image?: { url?: string };
  z_index?: number;
  name?: string;
  description?: string;
  bounding_box?: { absolute?: number[]; normalized?: number[] };
};
type FalResult = {
  images?: Array<{ url?: string }>;
  layers?: FalLayer[];
};

async function falLayerize(model: "bytedance/seedream/v5/pro/layerize" | "fal-ai/qwen-image-layered", imageUrl: string, prompt: string, size: string): Promise<LayerizeResult> {
  const submitted = await falRequest<FalSubmit>(model, {
    method: "POST",
    body: JSON.stringify({
      input: model.includes("seedream")
        ? {
            image_url: imageUrl,
            prompt: prompt || undefined,
            image_size: size === "auto" ? "auto" : `auto_${size}`,
            enhance_prompt_mode: "standard",
          }
        : {
            image_url: imageUrl,
            prompt: prompt || undefined,
          },
    }),
  });
  if (!submitted.request_id) throw new Error("fal.ai did not return a request id");

  const deadline = Date.now() + 180_000;
  let delay = 1_500;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    const status = await falRequest<FalStatus>(`${model}/requests/${encodeURIComponent(submitted.request_id)}/status`);
    if (status.status === "COMPLETED") break;
    if (status.status === "FAILED") throw new Error("fal.ai layer separation failed");
    delay = Math.min(delay + 500, 4_000);
  }
  if (Date.now() >= deadline) throw new Error("Layer separation timed out");

  const result = await falRequest<FalResult>(`${model}/requests/${encodeURIComponent(submitted.request_id)}`);
  const items = Array.isArray(result.layers) ? result.layers : [];
  const imageItems = Array.isArray(result.images) ? result.images : [];
  const baseUrl = imageItems[0]?.url ?? items.find((item) => (item.z_index ?? 0) === 0)?.image?.url;
  if (!baseUrl) throw new Error("fal.ai layer separation returned no base image");

  const layers = items
    .filter((item) => typeof item.image?.url === "string")
    .filter((item) => (item.z_index ?? 0) !== 0)
    .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0))
    .map((item, index) => ({
      id: `layer-${item.z_index ?? index + 1}-${index}`,
      url: item.image!.url!,
      zIndex: item.z_index ?? index + 1,
      name: item.name?.trim() || `Layer ${index + 1}`,
      description: item.description,
      boundingBox: item.bounding_box,
    }));

  return {
    provider: model.includes("seedream") ? "fal-seedream" : "fal-qwen",
    layerizer: model.includes("seedream") ? "Seedream 5.0 Pro Layerize (fal.ai)" : "Qwen Image Layered (fal.ai)",
    baseUrl,
    layers,
  };
}

export const layerizeImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(INPUT.parse)
  .handler(async ({ data }): Promise<LayerizeResult> => {
    assertTrustedUrl(data.imageUrl);

    // Aurora's default is ModelArk because it is already the user's primary
    // Seed provider. The important architectural point is that this receives
    // an OUTPUT image URL, not a model key — so the source model is irrelevant.
    const provider = data.provider === "auto"
      ? (getBytePlusKey() ? "modelark" : process.env.FAL_KEY ? "fal-seedream" : "modelark")
      : data.provider;

    if (provider === "modelark") {
      return normalizeModelArk(await bytePlusLayerize({
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        size: data.size,
      }));
    }

    if (provider === "fal-qwen") {
      return falLayerize("fal-ai/qwen-image-layered", data.imageUrl, data.prompt, data.size);
    }

    return falLayerize("bytedance/seedream/v5/pro/layerize", data.imageUrl, data.prompt, data.size);
  });
