// Generation error classifier (task #105) — pure classification tests.
// classifyGenerationError/friendlyGenerationMessage decide what customers see
// for a raw provider/app error string. Order matters (out_of_credit is a more
// specific bucket than the broader rate_limited one it overlaps with), and
// provider-dump / app-authored messages must never leak or be mangled.
import { describe, expect, test } from "bun:test";
import { classifyGenerationError, friendlyGenerationMessage } from "./error-toasts";

describe("classifyGenerationError — ordering", () => {
  test("a Replicate low-balance 429 that also says 'rate limit' is out_of_credit, not rate_limited", () => {
    const err = new Error(
      "429: Request failed. You have been reduced to 6 requests per minute while you have less than $5.0 in credit remaining. This is a rate limit.",
    );
    expect(classifyGenerationError(err)).toBe("out_of_credit");
  });

  test("a plain 429 rate limit with no credit/balance signal is rate_limited", () => {
    const err = new Error("429: Too many requests, please slow down.");
    expect(classifyGenerationError(err)).toBe("rate_limited");
  });

  test("insufficient Aura is checked before provider-level buckets", () => {
    const err = new Error("Insufficient credits: not enough Aura for this job (also 429 too many requests)");
    expect(classifyGenerationError(err)).toBe("insufficient_aura");
  });

  test("'not enough aura' phrasing also maps to insufficient_aura", () => {
    expect(classifyGenerationError(new Error("Not enough Aura to continue"))).toBe("insufficient_aura");
  });

  test("no GPU worker online maps to no_workers", () => {
    expect(classifyGenerationError(new Error("No GPU worker available for this kind"))).toBe("no_workers");
    expect(classifyGenerationError(new Error("All GPU workers failed to respond"))).toBe("no_workers");
  });

  test("a 'reduced to N requests' throttle without credit language is rate_limited", () => {
    expect(classifyGenerationError(new Error("You have been reduced to 3 requests per minute."))).toBe(
      "rate_limited",
    );
  });

  test("timeout messages are classified distinctly from provider throttling", () => {
    expect(classifyGenerationError(new Error("Request timed out after 60s"))).toBe("timeout");
    expect(classifyGenerationError(new Error("Generation timeout"))).toBe("timeout");
  });
});

describe("classifyGenerationError — provider dumps", () => {
  test("'Kling 500: {...}' style dumps map to provider", () => {
    expect(classifyGenerationError(new Error('Kling 500: {"error":"internal"}'))).toBe("provider");
  });

  test("'worker x -> 500' style GPU pool failures map to provider", () => {
    expect(classifyGenerationError(new Error("worker gpu-1 -> 500 Internal Server Error"))).toBe("provider");
    expect(classifyGenerationError(new Error("worker gpu-1 FAILED: connection reset"))).toBe("provider");
  });

  test("'Fal 402: {}' style out-of-funds dumps map to out_of_credit, not provider", () => {
    expect(classifyGenerationError(new Error("Fal 402: {}"))).toBe("out_of_credit");
  });

  test("a plain '500: ...' dump maps to provider", () => {
    expect(classifyGenerationError(new Error("500: Internal Server Error"))).toBe("provider");
  });

  test("known provider-error phrases map to provider", () => {
    expect(classifyGenerationError(new Error("Replicate create failed"))).toBe("provider");
    expect(classifyGenerationError(new Error("Replicate poll failed: status unknown"))).toBe("provider");
    expect(classifyGenerationError(new Error("No provider available for this kind"))).toBe("provider");
    expect(classifyGenerationError(new Error("All providers failed"))).toBe("provider");
  });

  test("owner misconfiguration errors map to provider, not leaked verbatim", () => {
    expect(classifyGenerationError(new Error("No Replicate mapping for kind lipsync"))).toBe("provider");
    expect(classifyGenerationError(new Error("No text model mapping configured"))).toBe("provider");
    expect(classifyGenerationError(new Error("No path for kind: performance_reskin"))).toBe("provider");
  });
});

describe("classifyGenerationError — app-authored / passthrough messages", () => {
  test("app-authored validation messages are not misclassified as provider dumps", () => {
    expect(classifyGenerationError(new Error("Generate a base shot first"))).toBe("unknown");
    expect(classifyGenerationError(new Error("sync: video+audio required"))).toBe("unknown");
  });

  test("empty/non-Error inputs classify as unknown", () => {
    expect(classifyGenerationError(new Error(""))).toBe("unknown");
    expect(classifyGenerationError(undefined)).toBe("unknown");
  });
});

describe("friendlyGenerationMessage", () => {
  test("known kinds map to their fixed, safe copy (never the raw dump)", () => {
    expect(friendlyGenerationMessage(new Error('Kling 500: {"error":"internal"}'))).toBe(
      "AI provider is temporarily unavailable. Try a different model.",
    );
    expect(friendlyGenerationMessage(new Error("Fal 402: {}"))).toBe(
      "The AI service is busy right now. Please wait a moment and try again.",
    );
    expect(
      friendlyGenerationMessage(
        new Error("429: reduced to 6 requests per minute while you have less than $5.0 in credit"),
      ),
    ).toBe("The AI service is busy right now. Please wait a moment and try again.");
    expect(friendlyGenerationMessage(new Error("429: too many requests"))).toBe(
      "The image/video service is busy right now. Please wait a moment and try again.",
    );
    expect(friendlyGenerationMessage(new Error("Insufficient credits"))).toBe(
      "Not enough Aura. Top up to generate.",
    );
    expect(friendlyGenerationMessage(new Error("No GPU worker available"))).toBe(
      "This feature needs a GPU worker online. Try again once a worker is connected.",
    );
    expect(friendlyGenerationMessage(new Error("Request timed out"))).toBe(
      "Generation took too long. Try a simpler prompt.",
    );
  });

  test("app-authored / unrecognized messages pass through verbatim", () => {
    expect(friendlyGenerationMessage(new Error("Generate a base shot first"))).toBe(
      "Generate a base shot first",
    );
    expect(friendlyGenerationMessage(new Error("sync: video+audio required"))).toBe(
      "sync: video+audio required",
    );
  });

  test("a truly empty error falls back to a generic message", () => {
    expect(friendlyGenerationMessage(new Error(""))).toBe("Generation failed");
  });
});
