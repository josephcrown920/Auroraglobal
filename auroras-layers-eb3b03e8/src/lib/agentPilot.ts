type AgentKey = "director" | "production";
type Message = { role: "system" | "user" | "assistant"; content: string };

const TIMEOUT_MS = 1_500;
const MAX_TELEMETRY_CHARS = 12_000;

function enabled() {
  return process.env["AGENTPILOT_ENABLED"] === "true";
}

function config() {
  const baseUrl = process.env["AGENTPILOT_SERVICE_URL"];
  const token = process.env["AGENTPILOT_SERVICE_TOKEN"];
  return baseUrl && token ? { baseUrl: baseUrl.replace(/\/$/, ""), token } : undefined;
}

async function request(path: string, init?: RequestInit) {
  const service = config();
  if (!enabled() || !service) throw new Error("AgentPilot integration is disabled");
  const response = await fetch(`${service.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${service.token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`AgentPilot service returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function resolveAgentPrompt(agent: AgentKey, fallback: string): Promise<string> {
  try {
    const payload = (await request(`/v1/agents/${agent}/prompt`)) as { messages?: unknown };
    if (!Array.isArray(payload.messages)) return fallback;
    const system = payload.messages.find(
      (message): message is Record<string, unknown> =>
        !!message &&
        typeof message === "object" &&
        (message.role === "system" || message.Role === "system"),
    );
    const content = system?.content ?? system?.Content;
    return typeof content === "string" && content.trim() ? content.trim() : fallback;
  } catch {
    return fallback;
  }
}

export function recordAgentRun(
  agentKey: AgentKey,
  model: string,
  messages: Message[],
  output: string,
) {
  if (!enabled() || !config()) return;
  const runId = crypto.randomUUID();
  const safeMessages = messages
    .slice(-12)
    .map(({ role, content }) => ({ role, content: content.slice(0, MAX_TELEMETRY_CHARS) }));
  const body = JSON.stringify({
    agentKey,
    runId,
    model,
    messages: safeMessages,
    output: output.slice(0, MAX_TELEMETRY_CHARS),
  });
  void request("/v1/runs", { method: "POST", body }).catch(() => undefined);
  void request("/v1/evaluations", { method: "POST", body }).catch(() => undefined);
}
