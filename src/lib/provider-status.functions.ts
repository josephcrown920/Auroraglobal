import { createServerFn } from "@tanstack/react-start";

/**
 * Public check of which provider keys are configured on the server.
 * Used by UI banners (e.g. "Connect Replicate") and the orchestration dashboard.
 * Returns booleans only — never the secret values.
 */
export const providerStatus = createServerFn({ method: "GET" }).handler(async () => {
  const has = (k: string) => Boolean(process.env[k]);
  const replicate =
    has("LOVABLE_CONNECTOR_REPLICATE_API_KEY") || has("REPLICATE_API_KEY");
  return {
    replicate,
    lovable: has("LOVABLE_API_KEY"),
    gemini: has("GEMINI_API_KEY"),
    openrouter: has("OPENROUTER_API_KEY"),
    openai: has("OPENAI_API_KEY"),
    fal: has("FAL_KEY"),
    huggingface: has("HF_TOKEN"),
    sync: has("SYNC_API_KEY"),
    kling: has("KLING_ACCESS_KEY") && has("KLING_SECRET_KEY"),
    heygen: has("HEYGEN_API_KEY"),
  };
});
