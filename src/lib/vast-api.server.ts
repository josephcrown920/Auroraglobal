// Vast.ai REST API client (server-only).
//
// Thin, validated wrapper around console.vast.ai/api/v0. The VASTAI_API_KEY
// credential never leaves the server — the CLI talks to Aurora's own
// owner-authenticated routes, which call this client.
//
// Every response is shape-validated before use; Vast's API returns loosely
// typed JSON and a silent mis-parse here could mis-price a rental.

const VAST_BASE = "https://console.vast.ai/api/v0";

export class VastApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "VastApiError";
  }
}

export function getVastKey(): string {
  const key = process.env.VASTAI_API_KEY?.trim();
  if (!key) {
    throw new VastApiError(
      "VASTAI_API_KEY is not configured. Add it via Replit Secrets (get the key from https://cloud.vast.ai/account/).",
    );
  }
  return key;
}

async function vastFetch(
  path: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const key = getVastKey();
  const res = await fetchImpl(`${VAST_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new VastApiError(`Vast API returned non-JSON (${res.status}): ${text.slice(0, 200)}`, res.status);
  }
  if (!res.ok) {
    const msg =
      (json as { error?: string; msg?: string } | null)?.error ??
      (json as { msg?: string } | null)?.msg ??
      text.slice(0, 200);
    if (res.status === 401 && /Two Factor/i.test(String(msg))) {
      throw new VastApiError(
        "Vast rejected the API key: instance operations require an API key created AFTER enabling Two-Factor Authentication on the Vast account. Enable 2FA at cloud.vast.ai, regenerate the key, and update VASTAI_API_KEY.",
        401,
      );
    }
    throw new VastApiError(`Vast API ${res.status}: ${msg}`, res.status);
  }
  return json;
}

// ── Types (validated subsets of Vast's payloads) ──────────────────────────────

export type VastOffer = {
  /** Vast "ask" id used to create an instance from this offer. */
  id: number;
  gpu_name: string;
  num_gpus: number;
  /** Total on-demand $/hr for the whole offer. */
  dph_total: number;
  gpu_ram_gb: number;
  disk_space_gb: number;
  cuda_max_good: number | null;
  reliability: number | null;
  geolocation: string | null;
  verified: boolean;
};

export type VastInstance = {
  id: number;
  actual_status: string | null;
  intended_status: string | null;
  gpu_name: string | null;
  num_gpus: number | null;
  dph_total: number | null;
  public_ipaddr: string | null;
  /** Container-port → external mapping, e.g. { "8000/tcp": [{HostIp,HostPort}] } */
  ports: Record<string, Array<{ HostIp?: string; HostPort?: string }>> | null;
  label: string | null;
  start_date: number | null;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function parseOffer(raw: unknown): VastOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = num(r.id) ?? num(r.ask_contract_id);
  const dph = num(r.dph_total);
  const gpu = str(r.gpu_name);
  if (id == null || dph == null || !gpu) return null; // unusable offer — drop
  return {
    id,
    gpu_name: gpu,
    num_gpus: num(r.num_gpus) ?? 1,
    dph_total: dph,
    gpu_ram_gb: Math.round(((num(r.gpu_ram) ?? 0) / 1024) * 10) / 10, // MB → GB
    disk_space_gb: Math.round(num(r.disk_space) ?? 0),
    cuda_max_good: num(r.cuda_max_good),
    reliability: num(r.reliability2) ?? num(r.reliability),
    geolocation: str(r.geolocation),
    verified: r.verification === "verified",
  };
}

export function parseInstance(raw: unknown): VastInstance | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = num(r.id);
  if (id == null) return null;
  return {
    id,
    actual_status: str(r.actual_status),
    intended_status: str(r.intended_status),
    gpu_name: str(r.gpu_name),
    num_gpus: num(r.num_gpus),
    dph_total: num(r.dph_total),
    public_ipaddr: str(r.public_ipaddr),
    ports: (r.ports && typeof r.ports === "object" ? r.ports : null) as VastInstance["ports"],
    label: str(r.label),
    start_date: num(r.start_date),
  };
}

// ── Env serialization ─────────────────────────────────────────────────────────

/**
 * Vast's create-instance API takes `env` as a single Docker-flags string
 * (e.g. `-e KEY=value -p 8000:8000`), not a JSON object. Values are wrapped in
 * single quotes with embedded quotes escaped so secrets/URLs survive intact.
 */
export function buildEnvString(env: Record<string, string>, ports: number[]): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new VastApiError(`Invalid env var name for Vast: ${JSON.stringify(key)}`);
    }
    const quoted = `'${value.replace(/'/g, `'\\''`)}'`;
    parts.push(`-e ${key}=${quoted}`);
  }
  for (const port of ports) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new VastApiError(`Invalid port for Vast mapping: ${String(port)}`);
    }
    parts.push(`-p ${port}:${port}`);
  }
  return parts.join(" ");
}

// ── API surface ───────────────────────────────────────────────────────────────

export type VastClient = {
  searchOffers(opts: { maxHourlyUsd: number; minGpuRamGb?: number; limit?: number }): Promise<VastOffer[]>;
  /** Fetch ONE offer by ask id — used to re-validate price immediately before renting. */
  getOfferById(offerId: number): Promise<VastOffer | null>;
  listInstances(): Promise<VastInstance[]>;
  getInstance(id: number): Promise<VastInstance | null>;
  createInstance(offerId: number, opts: {
    image: string;
    env: Record<string, string>;
    /** Container ports to expose 1:1 (serialized as `-p N:N` Docker flags). */
    ports: number[];
    onstartCmd: string;
    diskGb: number;
    label: string;
  }): Promise<{ instanceId: number }>;
  stopInstance(id: number): Promise<void>;
  destroyInstance(id: number): Promise<void>;
};

export function createVastClient(fetchImpl: typeof fetch = fetch): VastClient {
  return {
    async searchOffers({ maxHourlyUsd, minGpuRamGb = 16, limit = 20 }) {
      // Vast's search: PUT /bundles/ with a query object. rentable + verified
      // on-demand offers under the price ceiling, enough VRAM for lipsync.
      const q = {
        rentable: { eq: true },
        rented: { eq: false },
        verified: { eq: true },
        dph_total: { lte: maxHourlyUsd },
        gpu_ram: { gte: minGpuRamGb * 1024 },
        num_gpus: { eq: 1 },
        cuda_max_good: { gte: 11.8 },
        type: "on-demand",
        order: [["dph_total", "asc"]],
        limit,
      };
      // Live-verified 2026-08-10: search is POST /bundles/ (PUT returns 404).
      const json = await vastFetch(`/bundles/`, { method: "POST", body: JSON.stringify(q) }, fetchImpl);
      const offers = (json as { offers?: unknown[] } | null)?.offers;
      if (!Array.isArray(offers)) throw new VastApiError("Vast search: missing offers array");
      return offers.map(parseOffer).filter((o): o is VastOffer => o !== null);
    },

    async getOfferById(offerId) {
      // Live-verified: filtering by `id` returns nothing; `ask_contract_id` works.
      const q = { ask_contract_id: { eq: offerId }, type: "on-demand", limit: 1 };
      const json = await vastFetch(`/bundles/`, { method: "POST", body: JSON.stringify(q) }, fetchImpl);
      const offers = (json as { offers?: unknown[] } | null)?.offers;
      if (!Array.isArray(offers)) throw new VastApiError("Vast offer lookup: missing offers array");
      const parsed = offers.map(parseOffer).find((o) => o?.id === offerId);
      return parsed ?? null;
    },

    async listInstances() {
      const json = await vastFetch(`/instances/?owner=me`, {}, fetchImpl);
      const instances = (json as { instances?: unknown[] } | null)?.instances;
      if (!Array.isArray(instances)) throw new VastApiError("Vast instances: missing instances array");
      return instances.map(parseInstance).filter((i): i is VastInstance => i !== null);
    },

    async getInstance(id) {
      const json = await vastFetch(`/instances/${id}/`, {}, fetchImpl).catch((e) => {
        if (e instanceof VastApiError && e.status === 404) return null;
        throw e;
      });
      if (json == null) return null;
      const raw = (json as { instances?: unknown }).instances ?? json;
      return parseInstance(raw);
    },

    async createInstance(offerId, opts) {
      // NOTE on pricing: Vast's `price` field on create applies only to
      // interruptible/bid instances, NOT the on-demand rentals we search for —
      // so it is deliberately absent. The $ ceiling for on-demand is enforced
      // by the caller's live offer re-validation immediately before this call.
      const body = {
        client_id: "me",
        image: opts.image,
        env: buildEnvString(opts.env, opts.ports),
        onstart: opts.onstartCmd,
        disk: opts.diskGb,
        label: opts.label,
        runtype: "ssh", // container stays up; onstart runs the worker
      };
      const json = await vastFetch(`/asks/${offerId}/`, { method: "PUT", body: JSON.stringify(body) }, fetchImpl);
      const j = json as { success?: boolean; new_contract?: unknown } | null;
      const instanceId = num(j?.new_contract);
      if (j?.success !== true || instanceId == null) {
        throw new VastApiError(`Vast create failed: ${JSON.stringify(json).slice(0, 200)}`);
      }
      return { instanceId };
    },

    async stopInstance(id) {
      await vastFetch(`/instances/${id}/`, { method: "PUT", body: JSON.stringify({ state: "stopped" }) }, fetchImpl);
    },

    async destroyInstance(id) {
      try {
        await vastFetch(`/instances/${id}/`, { method: "DELETE" }, fetchImpl);
      } catch (e) {
        // 404 = already gone on Vast's side: destroying is idempotent.
        if (e instanceof VastApiError && e.status === 404) return;
        throw e;
      }
    },
  };
}
