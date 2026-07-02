// ─── Playground sandbox ───────────────────────────────────────────────────────
//
// User scripts run in a dedicated Web Worker built from a Blob — never on the
// server and never on the main thread. The worker has NO auth material: every
// `aurora.*` call posts an `api` message to the main thread, which attaches the
// signed-in user's bearer token and performs the fetch. Responses are posted
// back by request id. Stopping a run terminates the worker outright.

export type LogLevel = "log" | "info" | "warn" | "error";

/** Messages the worker sends to the main thread. */
export type WorkerOutMessage =
  | { type: "console"; level: LogLevel; text: string }
  | { type: "api"; id: number; path: string; body: unknown }
  | { type: "progress"; current: number; total: number; label?: string }
  | { type: "result"; url: string; kind?: string; label?: string }
  | { type: "done" }
  | { type: "error"; message: string };

/** Messages the main thread sends to the worker. */
export type WorkerInMessage =
  | { type: "run"; code: string }
  | { type: "api-result"; id: number; ok: boolean; data?: unknown; error?: string };

const LOG_LEVELS: readonly string[] = ["log", "info", "warn", "error"];

/** Validate an untyped worker message into our protocol (or null). */
export function parseWorkerMessage(raw: unknown): WorkerOutMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  switch (m.type) {
    case "console":
      if (typeof m.text === "string" && LOG_LEVELS.includes(m.level as string)) {
        return { type: "console", level: m.level as LogLevel, text: m.text };
      }
      return null;
    case "api":
      if (typeof m.id === "number" && typeof m.path === "string") {
        return { type: "api", id: m.id, path: m.path, body: m.body };
      }
      return null;
    case "progress":
      if (typeof m.current === "number" && typeof m.total === "number") {
        return {
          type: "progress",
          current: m.current,
          total: m.total,
          label: typeof m.label === "string" ? m.label : undefined,
        };
      }
      return null;
    case "result":
      if (typeof m.url === "string") {
        return {
          type: "result",
          url: m.url,
          kind: typeof m.kind === "string" ? m.kind : undefined,
          label: typeof m.label === "string" ? m.label : undefined,
        };
      }
      return null;
    case "done":
      return { type: "done" };
    case "error":
      return { type: "error", message: typeof m.message === "string" ? m.message : "Unknown error" };
    default:
      return null;
  }
}

/** API paths a sandbox script may call (proxied with the user's auth). */
export const ALLOWED_API_PATHS: readonly string[] = ["/api/public/generate"];

export function isAllowedApiPath(path: string): boolean {
  return ALLOWED_API_PATHS.includes(path);
}

// ─── Worker bootstrap source ─────────────────────────────────────────────────
// Kept as a plain string so we can build a Blob worker without a bundler asset.
// IMPORTANT: this source must never embed tokens or secrets — auth stays on the
// main thread.
/**
 * Worker globals that would let user code make direct network calls (or spawn
 * a fresh worker with unblocked globals). Each is shadowed with a throwing
 * getter before any user code runs — the ONLY egress from the sandbox is the
 * main-thread proxy, which enforces ALLOWED_API_PATHS.
 */
export const BLOCKED_WORKER_GLOBALS: readonly string[] = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts",
  "caches",
  "Worker",
  "SharedWorker",
  "eval",
  "Function",
];

export const WORKER_SOURCE = String.raw`
"use strict";

// ── Egress lockdown ── user code must not reach the network directly; the
// only capability surface is the aurora.* proxy (allow-listed on the main
// thread). Shadow every direct-network global BEFORE any user code can run:
//  - a non-configurable throwing getter on the global itself, AND
//  - removal (or shadowing) on every prototype in the chain, so
//    Object.getPrototypeOf(self).fetch.call(self, ...) is dead too.
// Dynamic import() is syntax (can't be shadowed) — it is rejected by a static
// scan in the run handler below, and every runtime code-generation primitive
// that could synthesize an import at runtime (eval, the Function constructor
// family, string-argument timers) is locked down as well.
// The hard security boundary on top of all this remains token isolation: this
// worker never holds auth material, and every proxied call is allow-listed on
// the main thread.
const __BLOCKED = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "caches", "Worker", "SharedWorker", "eval", "Function"];
function __deny(name) {
  throw new Error("Blocked: '" + name + "' is disabled in the Aurora sandbox. Use the aurora.* APIs instead.");
}
function __lockName(root, name) {
  try {
    Object.defineProperty(root, name, {
      configurable: false,
      get() { __deny(name); },
      set() {},
    });
  } catch (e) { /* own prop non-configurable or absent — continue to prototypes */ }
  let proto = Object.getPrototypeOf(root);
  while (proto && proto !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(proto, name)) {
      try { delete proto[name]; } catch (e) { /* not deletable */ }
      if (Object.prototype.hasOwnProperty.call(proto, name)) {
        try {
          Object.defineProperty(proto, name, {
            configurable: false,
            get() { __deny(name); },
            set() {},
          });
        } catch (e) { /* non-configurable — nothing more we can do */ }
      }
    }
    proto = Object.getPrototypeOf(proto);
  }
}
// Capture the real primitives we still need BEFORE locking them away from
// user code. The run handler compiles user scripts with __RealFunction.
const __RealFunction = Function;
const __realSetTimeout = setTimeout.bind(self);
const __realSetInterval = setInterval.bind(self);

for (const __name of __BLOCKED) __lockName(self, __name);
try {
  if (self.navigator) __lockName(self.navigator, "sendBeacon");
} catch (e) { /* ignore */ }

// Close the constructor escape hatch: (function(){}).constructor and its
// async/generator variants hand back the Function-constructor family, which
// can compile arbitrary strings (including a synthesized import()). Shadow
// .constructor on each intrinsic function prototype with a throwing getter.
// Realm guard: only do this inside a REAL worker — unit tests boot this
// source against a mock self in a shared realm, where patching intrinsics
// would poison the host process.
if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
  const __blockCtor = (protoObj) => {
    try {
      Object.defineProperty(protoObj, "constructor", {
        configurable: false,
        get() { __deny("Function"); },
        set() {},
      });
    } catch (e) { /* non-configurable — leave as-is */ }
  };
  __blockCtor(__RealFunction.prototype);
  __blockCtor(Object.getPrototypeOf(async function () {}));
  __blockCtor(Object.getPrototypeOf(function* () {}));
  __blockCtor(Object.getPrototypeOf(async function* () {}));
}

// Timers accept string code in workers (an eval-equivalent). Replace them
// with wrappers that only accept functions, and strip the originals from the
// prototype chain.
function __wrapTimer(name, real) {
  const wrapped = function (handler, ...rest) {
    if (typeof handler !== "function") __deny(name + " with string code");
    return real(handler, ...rest);
  };
  try {
    Object.defineProperty(self, name, { configurable: false, writable: false, value: wrapped });
  } catch (e) { /* ignore */ }
  let proto = Object.getPrototypeOf(self);
  while (proto && proto !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(proto, name)) {
      try { delete proto[name]; } catch (e) { /* not deletable */ }
    }
    proto = Object.getPrototypeOf(proto);
  }
}
__wrapTimer("setTimeout", __realSetTimeout);
__wrapTimer("setInterval", __realSetInterval);

let __seq = 0;
const __pending = new Map();

function __post(msg) { self.postMessage(msg); }

function __fmt(v) {
  if (typeof v === "string") return v;
  if (v instanceof Error) return v.message;
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

function __log(level) {
  return (...args) => __post({ type: "console", level, text: args.map(__fmt).join(" ") });
}
console.log = __log("log");
console.info = __log("info");
console.warn = __log("warn");
console.error = __log("error");

function __api(path, body) {
  return new Promise((resolve, reject) => {
    const id = ++__seq;
    __pending.set(id, { resolve, reject });
    __post({ type: "api", id, path, body });
  });
}

async function __generate(opts) {
  if (!opts || typeof opts !== "object") throw new Error("aurora.generate(options) requires an options object");
  if (!opts.kind) throw new Error("aurora.generate: 'kind' is required (image | video | lipsync | text | audio)");
  const res = await __api("/api/public/generate", opts);
  return res;
}

const aurora = {
  generate: __generate,
  image: (prompt, opts) => __generate({ kind: "image", prompt, ...(opts || {}) }),
  video: (opts) => __generate({ kind: "video", ...(opts || {}) }),
  lipsync: (opts) => __generate({ kind: "lipsync", ...(opts || {}) }),
  text: (prompt, opts) => __generate({ kind: "text", prompt, ...(opts || {}) }),
  progress: (current, total, label) => __post({ type: "progress", current, total, label }),
  show: (url, label, kind) => __post({ type: "result", url, kind, label }),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "api-result") {
    const p = __pending.get(msg.id);
    if (!p) return;
    __pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.data);
    else p.reject(new Error(msg.error || "API call failed"));
    return;
  }
  if (msg.type === "run") {
    // Dynamic import() is a network-capable syntax form that cannot be
    // shadowed like a global. Reject any use of the reserved word "import"
    // outright (it cannot be an identifier, so legitimate scripts never need
    // it — only strings/comments could trip this, and the error explains why).
    if (/\bimport\b/.test(String(msg.code))) {
      __post({ type: "error", message: "Blocked: 'import' is disabled in the Aurora sandbox. Use the aurora.* APIs instead." });
      return;
    }
    try {
      // Pass the patched console and the (locked-down) worker global in
      // explicitly, so user code sees them even though new Function bodies
      // resolve identifiers from the global scope.
      const fn = new __RealFunction(
        "aurora",
        "console",
        "self",
        "globalThis",
        "return (async () => {\n" + msg.code + "\n})()",
      );
      await fn(aurora, console, self, self);
      __post({ type: "done" });
    } catch (err) {
      __post({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }
};

self.onunhandledrejection = (ev) => {
  __post({ type: "error", message: ev.reason instanceof Error ? ev.reason.message : String(ev.reason) });
};
`;

// ─── Main-thread runner ──────────────────────────────────────────────────────

export type SandboxEvent =
  | { type: "console"; level: LogLevel; text: string }
  | { type: "api-call"; path: string; summary: string }
  | { type: "progress"; current: number; total: number; label?: string }
  | { type: "result"; url: string; kind?: string; label?: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type SandboxRunner = {
  stop: () => void;
};

export function summarizeApiBody(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const b = body as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof b.kind === "string") parts.push(b.kind);
  if (typeof b.model === "string") parts.push(b.model);
  if (typeof b.prompt === "string") {
    const p = b.prompt.length > 60 ? b.prompt.slice(0, 57) + "…" : b.prompt;
    parts.push(`“${p}”`);
  }
  return parts.join(" · ");
}

/**
 * Run compiled JS in a fresh Blob worker. `getToken` is called lazily per API
 * request on the MAIN thread — the token itself never crosses into the worker.
 */
export function runInSandbox(opts: {
  code: string;
  getToken: () => Promise<string | null>;
  onEvent: (ev: SandboxEvent) => void;
}): SandboxRunner {
  const { code, getToken, onEvent } = opts;
  const blob = new Blob([WORKER_SOURCE], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  let stopped = false;

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    worker.terminate();
    URL.revokeObjectURL(url);
  };

  worker.onmessage = async (ev: MessageEvent) => {
    const msg = parseWorkerMessage(ev.data);
    if (!msg || stopped) return;

    if (msg.type === "api") {
      if (!isAllowedApiPath(msg.path)) {
        worker.postMessage({
          type: "api-result",
          id: msg.id,
          ok: false,
          error: `Blocked: ${msg.path} is not an allowed sandbox API`,
        } satisfies WorkerInMessage);
        return;
      }
      onEvent({ type: "api-call", path: msg.path, summary: summarizeApiBody(msg.body) });
      try {
        const token = await getToken();
        if (!token) throw new Error("Not signed in — sign in to run scripts that spend Aura");
        const res = await fetch(msg.path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(msg.body ?? {}),
        });
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const errText =
            data && typeof data === "object" && "error" in data
              ? String((data as { error: unknown }).error)
              : `HTTP ${res.status}`;
          throw new Error(errText);
        }
        if (stopped) return;
        worker.postMessage({ type: "api-result", id: msg.id, ok: true, data } satisfies WorkerInMessage);
      } catch (err) {
        if (stopped) return;
        worker.postMessage({
          type: "api-result",
          id: msg.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        } satisfies WorkerInMessage);
      }
      return;
    }

    if (msg.type === "done" || msg.type === "error") {
      onEvent(msg);
      cleanup();
      return;
    }

    onEvent(msg);
  };

  worker.onerror = (ev) => {
    onEvent({ type: "error", message: ev.message || "Worker crashed" });
    cleanup();
  };

  worker.postMessage({ type: "run", code } satisfies WorkerInMessage);

  return { stop: cleanup };
}
