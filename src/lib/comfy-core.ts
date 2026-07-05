// Pure, dependency-free helpers for the ComfyUI integration: declaring template
// inputs, validating user-supplied values, building the "nodeId.inputName" patch
// map ComfyUI's /prompt accepts, classifying outputs, guarding graph size, and
// filtering capable workers. No env, no DB, no network — so the validation/wire
// logic has one tested source of truth shared by the run page, admin tools, and
// the canvas node.

export type ComfyInputType = "text" | "image" | "number" | "seed" | "select" | "boolean";

export type DeclaredInput = {
  /** Patch target in the ComfyUI graph: "<nodeId>.<inputName>" (e.g. "6.text"). */
  key: string;
  label: string;
  type: ComfyInputType;
  required?: boolean;
  /** Allowed values for `select`. */
  options?: string[];
  default?: unknown;
  /** Inclusive bounds for `number` / `seed`. */
  min?: number;
  max?: number;
  placeholder?: string;
};

export type WorkflowKind = "image" | "video";

/** "nodeId.inputName" — node id may contain word chars, ':' or '-'; input is a word. */
const KEY_RE = /^[A-Za-z0-9_:-]+\.[A-Za-z0-9_]+$/;
const VALID_TYPES: ComfyInputType[] = ["text", "image", "number", "seed", "select", "boolean"];

export const MAX_WORKFLOW_BYTES = 256 * 1024; // 256 KB graph cap
export const MAX_DECLARED_INPUTS = 40;

/** Validate the declared-input SCHEMA of a template (not user values). */
export function validateDeclaredInputs(declared: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(declared)) return { ok: false, errors: ["declared_inputs must be an array"] };
  if (declared.length > MAX_DECLARED_INPUTS) errors.push(`too many inputs (max ${MAX_DECLARED_INPUTS})`);
  const seen = new Set<string>();
  declared.forEach((d, i) => {
    if (!d || typeof d !== "object") {
      errors.push(`input[${i}] must be an object`);
      return;
    }
    const inp = d as Record<string, unknown>;
    if (typeof inp.key !== "string" || !KEY_RE.test(inp.key)) {
      errors.push(`input[${i}].key must match "nodeId.inputName"`);
    } else if (seen.has(inp.key)) {
      errors.push(`duplicate input key "${inp.key}"`);
    } else {
      seen.add(inp.key);
    }
    if (typeof inp.label !== "string" || !inp.label.trim()) errors.push(`input[${i}].label is required`);
    if (typeof inp.type !== "string" || !VALID_TYPES.includes(inp.type as ComfyInputType)) {
      errors.push(`input[${i}].type must be one of ${VALID_TYPES.join(", ")}`);
    }
    if (inp.type === "select" && (!Array.isArray(inp.options) || inp.options.length === 0)) {
      errors.push(`input[${i}] (select) needs a non-empty options array`);
    }
  });
  return { ok: errors.length === 0, errors };
}

export type ValidatedValues = { ok: boolean; errors: string[]; values: Record<string, unknown> };

/** Validate + coerce user-supplied values against a template's declared inputs. */
export function validateInputValues(
  declared: DeclaredInput[],
  raw: Record<string, unknown> | undefined,
): ValidatedValues {
  const errors: string[] = [];
  const values: Record<string, unknown> = {};
  const input = raw ?? {};
  for (const d of declared) {
    const has = Object.prototype.hasOwnProperty.call(input, d.key);
    const v = has ? input[d.key] : undefined;
    const empty = v == null || v === "";
    if (empty) {
      if (d.required) errors.push(`${d.label} is required`);
      continue;
    }
    switch (d.type) {
      case "number":
      case "seed": {
        const n = typeof v === "number" ? v : Number(v);
        if (!Number.isFinite(n)) {
          errors.push(`${d.label} must be a number`);
          break;
        }
        const num = d.type === "seed" ? Math.trunc(n) : n;
        if (typeof d.min === "number" && num < d.min) {
          errors.push(`${d.label} must be ≥ ${d.min}`);
          break;
        }
        if (typeof d.max === "number" && num > d.max) {
          errors.push(`${d.label} must be ≤ ${d.max}`);
          break;
        }
        values[d.key] = num;
        break;
      }
      case "boolean":
        values[d.key] = typeof v === "boolean" ? v : v === "true" || v === 1 || v === "1";
        break;
      case "select":
        if (!d.options || !d.options.includes(String(v))) {
          errors.push(`${d.label} must be one of: ${(d.options ?? []).join(", ")}`);
          break;
        }
        values[d.key] = String(v);
        break;
      case "image":
        if (typeof v !== "string" || !/^https?:\/\//.test(v)) {
          errors.push(`${d.label} must be an image URL`);
          break;
        }
        values[d.key] = v;
        break;
      case "text":
      default:
        values[d.key] = String(v);
        break;
    }
  }
  return { ok: errors.length === 0, errors, values };
}

/**
 * Merge declared defaults → template default_inputs → validated user values into
 * the final `"nodeId.inputName": value` patch map. Only keys that are actually
 * declared survive, so a caller can never patch an undeclared node.
 */
export function buildComfyInputs(
  declared: DeclaredInput[],
  values: Record<string, unknown>,
  defaults?: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const allowed = new Set(declared.map((d) => d.key));
  for (const d of declared) if (d.default !== undefined) out[d.key] = d.default;
  if (defaults) for (const [k, val] of Object.entries(defaults)) if (allowed.has(k)) out[k] = val;
  for (const [k, val] of Object.entries(values)) if (allowed.has(k)) out[k] = val;
  return out;
}

/** Classify a ComfyUI /view output URL as image or video by its filename/ext. */
export function classifyComfyOutput(url: string | undefined): "image" | "video" | "unknown" {
  if (!url) return "unknown";
  let name = url;
  try {
    const u = new URL(url);
    name = u.searchParams.get("filename") || u.pathname;
  } catch {
    /* relative path — use as-is */
  }
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "avif"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "mkv", "m4v"].includes(ext)) return "video";
  return "unknown";
}

/** Guard the workflow graph: must be a non-empty JSON object within the size cap. */
export function validateWorkflowJson(
  json: unknown,
  maxBytes = MAX_WORKFLOW_BYTES,
): { ok: boolean; error?: string; nodeCount?: number } {
  if (json == null || typeof json !== "object" || Array.isArray(json)) {
    return { ok: false, error: "workflow must be a JSON object (the ComfyUI /prompt graph)" };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(json);
  } catch {
    return { ok: false, error: "workflow is not serializable" };
  }
  if (serialized.length > maxBytes) {
    return { ok: false, error: `workflow too large (${serialized.length} bytes > ${maxBytes})` };
  }
  const nodeCount = Object.keys(json as Record<string, unknown>).length;
  if (nodeCount === 0) return { ok: false, error: "workflow graph is empty" };
  return { ok: true, nodeCount };
}

export type ComfyWorkerLite = {
  id: string;
  name: string;
  protocol?: string | null;
  status?: string | null;
  capabilities?: string[] | null;
  worker_role?: string | null;
};

/** Only `comfyui`-protocol workers can run an arbitrary ComfyUI graph. */
export function isComfyWorker(w: ComfyWorkerLite): boolean {
  return (w.protocol ?? "") === "comfyui";
}

export function workerHasCapability(w: ComfyWorkerLite, capability: string): boolean {
  return Array.isArray(w.capabilities) && w.capabilities.includes(capability);
}

/** Active comfyui workers, optionally filtered to those advertising `kind`. */
export function pickComfyWorkers(workers: ComfyWorkerLite[], kind?: WorkflowKind): ComfyWorkerLite[] {
  return workers.filter(
    (w) => isComfyWorker(w) && (w.status ?? "active") === "active" && (!kind || workerHasCapability(w, kind)),
  );
}

/** Coarse progress percentage for a run status (used as a fallback before /ws). */
export function coarseProgress(status: string, current = 0): number {
  switch (status) {
    case "queued":
      return Math.max(5, current);
    case "running":
      return Math.min(95, Math.max(50, current));
    case "succeeded":
      return 100;
    case "failed":
      return current;
    default:
      return current;
  }
}
