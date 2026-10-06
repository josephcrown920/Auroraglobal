import type { OpenAICompatibleProviderSettings } from "@ai-sdk/openai-compatible";
import { bytePlusBaseUrl, fetchWithCredentialFallback } from "../byteplus.server";

/** Only the agent's text brain uses this chain; media selection is independent. */
export const AGENT_BRAIN_CHAIN = ["modelark", "openrouter-free"] as const;
export const FREE_OPENROUTER_MODEL = "openrouter/free";
export const FREE_OPENROUTER_BASE = "https://openrouter.ai/api/v1";

/**
 * Canonical ModelArk IDs used by the international BytePlus OpenAI-compatible
 * endpoint. The console UI shows friendly names such as "DeepSeek-V4-Flash-GA"
 * while the API expects the versioned model ID.
 */
export const MODELARK_MODEL_ALIASES: Readonly<Record<string, string>> = {
  "DeepSeek-V4-flash": "deepseek-v4-flash-ga-260731",
  "DeepSeek-V4-Flash": "deepseek-v4-flash-ga-260731",
  "DeepSeek-V4-Flash-GA": "deepseek-v4-flash-ga-260731",
  "DeepSeek-V4-pro": "deepseek-v4-pro-ga-260813",
  "DeepSeek-V4-Pro": "deepseek-v4-pro-ga-260813",
  "DeepSeek-V4-Pro-GA": "deepseek-v4-pro-ga-260813",
  "Dola-Seed-2.1-turbo": "dola-seed-2-1-turbo-260628",
  "Dola-Seed-2.0-lite": "seed-2-0-lite-260428",
  "Dola-Seed-2.0-mini": "seed-2-0-mini-260428",
  "Dola-Seed-2.0-pro": "seed-2-0-pro-260328",
  "ByteDance-Seed-1.8": "seed-1-8-251228",
  "ByteDance-Seed-1.6": "seed-1-6-250615",
  "ByteDance-Seed-1.6-flash": "seed-1-6-flash-250715",
};

export function normalizeModelArkTextModel(value: string): string {
  const trimmed = value.trim();
  return MODELARK_MODEL_ALIASES[trimmed] ?? trimmed;
}

type Fetcher = NonNullable<OpenAICompatibleProviderSettings["fetch"]>;

export function modelArkTextModel(): string {
  const configured = process.env.MODELARK_TEXT_MODEL?.trim() ?? "";
  return configured ? normalizeModelArkTextModel(configured) : "";
}

function requestBody(input: Parameters<Fetcher>[0], init: Parameters<Fetcher>[1], endpoint: string) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url !== endpoint || init?.method?.toUpperCase() !== "POST" || typeof init.body !== "string") {
    throw new Error("Agent provider blocked an unexpected request.");
  }
  const body = JSON.parse(init.body) as Record<string, unknown>;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Agent provider requires a JSON request object.");
  }
  return body;
}

/** Reuses the media integration's region and 401-only credential recovery. */
export const modelArkTextFetch: Fetcher = async (input, init) => {
  const body = requestBody(input, init, `${bytePlusBaseUrl()}/chat/completions`);
  const model = modelArkTextModel();
  if (!model || body.model !== model || body.models || body.route) {
    throw new Error("ModelArk text model is missing or does not match the server configuration.");
  }
  const { response } = await fetchWithCredentialFallback((key) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${key}`);
    return globalThis.fetch(input, { ...init, headers, redirect: "error" });
  });
  return response;
};

/**
 * Last-mile cost boundary. Never use the billed proxy, auto router, a caller's
 * fallback list, paid plugins, or paid provider endpoints for this adapter.
 */
export const freeOpenRouterFetch: Fetcher = async (input, init) => {
  const body = requestBody(input, init, `${FREE_OPENROUTER_BASE}/chat/completions`);
  if (
    body.model !== FREE_OPENROUTER_MODEL ||
    body.models || body.route || body.plugins
  ) {
    throw new Error("OpenRouter fallback permits only openrouter/free without paid fallbacks or plugins.");
  }
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing for the free fallback.");
  }
  body.provider = {
    allow_fallbacks: false,
    max_price: { prompt: 0, completion: 0, request: 0 },
  };
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${process.env.OPENROUTER_API_KEY}`);
  return globalThis.fetch(input, {
    ...init,
    headers,
    redirect: "error",
    body: JSON.stringify(body),
  });
};
