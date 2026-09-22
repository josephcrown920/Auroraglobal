import { z } from "zod";

const DEFAULT_ARK_BASE = "https://ark.ap-southeast.bytepluses.com/api/v3";
const DEFAULT_TEXT_MODEL = "dola-seed-2-1-turbo-260628";

export const ModelArkInputSchema = z.object({
  role: z.enum(["system", "user", "assistant", "developer"]),
  content: z.union([
    z.string(),
    z.array(z.record(z.string(), z.unknown())),
  ]),
});

export type ModelArkInput = z.infer<typeof ModelArkInputSchema>;

export function modelArkBaseUrl(): string {
  const raw = (process.env.ARK_BASE_URL || DEFAULT_ARK_BASE).replace(/\/+$/, "");
  return raw.endsWith("/api/v3") ? raw : `${raw}/api/v3`;
}

export function modelArkTextModel(): string {
  return (
    process.env.MODELARK_TEXT_MODEL?.trim() ||
    process.env.ARK_AGENT_MODEL?.trim() ||
    DEFAULT_TEXT_MODEL
  );
}

export function modelArkEnabled(): boolean {
  return Boolean(process.env.ARK_API_KEY?.trim() || process.env.BYTEPLUS_API_KEY?.trim());
}

function modelArkKey(): string {
  const key = process.env.ARK_API_KEY?.trim() || process.env.BYTEPLUS_API_KEY?.trim();
  if (!key) throw new Error("ARK_API_KEY is not configured");
  return key;
}

export type ModelArkResponseOptions = {
  input: unknown;
  model?: string;
  tools?: unknown[];
  previousResponseId?: string;
};

export async function modelArkResponses(options: ModelArkResponseOptions): Promise<Record<string, unknown>> {
  const payload: Record<string, unknown> = {
    model: options.model || modelArkTextModel(),
    input: options.input,
  };
  if (options.tools) payload.tools = options.tools;
  if (options.previousResponseId) payload.previous_response_id = options.previousResponseId;

  const response = await fetch(`${modelArkBaseUrl()}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${modelArkKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    body = { raw };
  }
  if (!response.ok) {
    const message =
      typeof body.error === "string"
        ? body.error
        : typeof (body.error as { message?: unknown } | undefined)?.message === "string"
          ? (body.error as { message: string }).message
          : `ModelArk request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const value = part as Record<string, unknown>;
      return typeof value.text === "string"
        ? value.text
        : typeof value.output_text === "string"
          ? value.output_text
          : "";
    })
    .filter(Boolean)
    .join("\n");
}

/** Handles both Responses API output_text and the nested output/content shape. */
export function modelArkText(response: Record<string, unknown>): string {
  if (typeof response.output_text === "string") return response.output_text;

  const output = response.output;
  if (Array.isArray(output)) {
    const text = output
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        const value = item as Record<string, unknown>;
        return textFromContent(value.content) || textFromContent(value.output);
      })
      .filter(Boolean)
      .join("\n");
    if (text) return text;
  }

  const choices = response.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      if (!choice || typeof choice !== "object") continue;
      const message = (choice as Record<string, unknown>).message;
      if (message && typeof message === "object") {
        const text = textFromContent((message as Record<string, unknown>).content);
        if (text) return text;
      }
    }
  }

  return "";
}

export async function modelArkListModels(): Promise<unknown> {
  const response = await fetch(`${modelArkBaseUrl()}/models?page_size=200`, {
    headers: { Authorization: `Bearer ${modelArkKey()}` },
  });
  const raw = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    body = { raw };
  }
  if (!response.ok) throw new Error(`ModelArk models request failed (${response.status})`);
  return body;
}