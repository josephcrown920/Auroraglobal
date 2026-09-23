import type { ToolResult } from "./types";

const DEFAULT_AGENT_ID = "agent-20260825135403-56jcb";
const DEFAULT_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";

type DirectorInput = {
  instruction: string;
  context?: Record<string, unknown>;
};

function config() {
  const apiKey = (process.env.ARK_API_KEY || process.env.BYTEPLUS_API_KEY || "").trim();
  const baseUrl = (process.env.ARK_BASE_URL || process.env.BYTEPLUS_BASE_URL || DEFAULT_BASE_URL).replace(/\\/+$/, "");
  const agentId = (process.env.MODELARK_AGENT_ID || DEFAULT_AGENT_ID).trim();
  if (!apiKey) throw new Error("ModelArk director is not configured: set ARK_API_KEY or BYTEPLUS_API_KEY.");
  return { apiKey, baseUrl, agentId };
}

async function jsonFetch(url: string, apiKey: string, init: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "message" in payload ? String((payload as { message?: unknown }).message) : response.statusText;
    throw new Error(`ModelArk request failed (${response.status}): ${detail}`);
  }
  return payload;
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const v = value as Record<string, unknown>;
  for (const key of ["text", "content", "message"]) {
    if (typeof v[key] === "string") return v[key] as string;
  }
  if (Array.isArray(v.content)) {
    return v.content.map((item) => extractText(item)).filter(Boolean).join("");
  }
  return "";
}

async function streamSession(url: string, apiKey: string, onEvent: (value: unknown) => void) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "text/event-stream",
    },
  });
  if (!response.ok || !response.body) {
    throw new Error(`ModelArk event stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\\r?\\n/);
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const event = JSON.parse(raw);
        onEvent(event);
        const eventType = String((event as Record<string, unknown>).type || (event as Record<string, unknown>).event || "");
        if (eventType === "error" || eventType.endsWith(".error")) {
          throw new Error(extractText(event) || "ModelArk agent returned an error.");
        }
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
}

export async function runModelArkDirector(input: DirectorInput): Promise<ToolResult> {
  if (!input.instruction.trim()) throw new Error("instruction is required");
  const { apiKey, baseUrl, agentId } = config();

  const session = await jsonFetch(`${baseUrl}/sessions`, apiKey, {
    method: "POST",
    body: JSON.stringify({ agent: agentId, title: "Aurora master director" }),
  }) as Record<string, unknown>;

  const sessionId = String(session.id || session.session_id || "");
  if (!sessionId) throw new Error("ModelArk did not return a session id.");

  const eventsUrl = `${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events/stream`;
  const events: unknown[] = [];
  const eventPromise = streamSession(eventsUrl, apiKey, (event) => events.push(event));

  await jsonFetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}/events`, apiKey, {
    method: "POST",
    body: JSON.stringify({
      event: {
        type: "user.message",
        content: [{ type: "text", text: JSON.stringify({ instruction: input.instruction, context: input.context || {} }) }],
      },
    }),
  });

  await eventPromise;
  const finalText = events.map(extractText).filter(Boolean).join("\\n").trim();

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        session_id: sessionId,
        agent_id: agentId,
        status: "completed",
        output: finalText || "ModelArk agent completed without a text payload.",
      }),
    }],
  };
}
