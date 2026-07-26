// Bun test preload — process-level config and suppression of cross-file noise
// from production modules that fire across many test files.
//
// NOTE: individual test files own their own console suppression via
// beforeAll/afterAll spyOn blocks (e.g. compress.server.test.ts,
// jobs.server.test.ts). This preload only handles patterns that would require
// identical boilerplate in dozens of test files and cannot be localised.
//
// Which patterns are suppressed here and why:
//   [orchestrator] * served by *   — every successful dispatch logs this; it's
//     structural confirmation that routing worked, not a test failure signal.
//   [llm-fallback] * failed: *     — expected failure-cascade messages from the
//     fallback chain tests.
//   [heygenVideoAgent] resolved:   — HeyGen avatar/voice resolution trace that
//     fires unconditionally inside the adapter (no test-only flag).
//   AI SDK Warning (*)             — from @ai-sdk/* when a feature is unsupported
//     by a model; exercised intentionally by the llm-fallback tests. Silenced via
//     the official `AI_SDK_LOG_WARNINGS = false` global AND via regex fallback.
//
// All other console output passes through unchanged so genuine failures are visible.

// Disable the @ai-sdk/* warning subsystem at the source.
(globalThis as unknown as Record<string, unknown>).AI_SDK_LOG_WARNINGS = false;

const SUPPRESS_INFO = /^\[orchestrator\] .+ served by /;
const SUPPRESS_WARN = /^\[llm-fallback\] .+ failed:|^AI SDK Warning/i;
const SUPPRESS_LOG  = /^\[heygenVideoAgent\] resolved:/;

const origInfo  = console.info.bind(console);
const origWarn  = console.warn.bind(console);
const origLog   = console.log.bind(console);

console.info = (...args: unknown[]) => {
  if (typeof args[0] === "string" && SUPPRESS_INFO.test(args[0])) return;
  origInfo(...args);
};

console.warn = (...args: unknown[]) => {
  if (typeof args[0] === "string" && SUPPRESS_WARN.test(args[0])) return;
  origWarn(...args);
};

console.log = (...args: unknown[]) => {
  if (typeof args[0] === "string" && SUPPRESS_LOG.test(args[0])) return;
  origLog(...args);
};
