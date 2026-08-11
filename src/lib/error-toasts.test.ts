// Generation error classifier — pure classification tests.
// classifyGenerationError/friendlyGenerationMessage decide what customers see
// for a raw provider/app error string. Order matters (out_of_credit is a more
// specific bucket than the broader rate_limited one it overlaps with), and
// provider-dump / app-authored messages must never leak or be mangled.
//
// This file also covers handlePaymentError/handleAuthError/handleWebhookError.
// error-toasts.ts is the ONLY module under test that imports "sonner" (verified:
// no other *.test.ts file imports sonner directly or transitively), so mocking
// "sonner" here via mock.module is safe from the process-global leakage this
// codebase has been bitten by before (see the Bun mock.module lesson) — this is
// the single suite that ever touches it.
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const toastError = mock(() => {});
const toastSuccess = mock(() => {});
mock.module("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));

const {
  classifyGenerationError,
  friendlyGenerationMessage,
  handlePaymentError,
  handleAuthError,
  handleWebhookError,
} = await import("./error-toasts");

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

  test("fal's 403 'User is locked / Exhausted balance' dump maps to out_of_credit, not provider", () => {
    // Real fal response (byte-exact): a 403 — not 402 — so the numeric-status
    // heuristic alone would misfile it as a generic provider outage.
    const err = new Error(
      'Fal 403: {"detail": "User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing."}',
    );
    expect(classifyGenerationError(err)).toBe("out_of_credit");
  });

  test("Replicate's 402 'Insufficient credit' dump maps to out_of_credit", () => {
    const err = new Error(
      'Replicate create failed (402): {"title":"Insufficient credit","detail":"You have insufficient credit to run this model. Go to https://replicate.com/account/billing#billing to purchase credit."}',
    );
    expect(classifyGenerationError(err)).toBe("out_of_credit");
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

describe("handlePaymentError", () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  test("a declined card shows the declined-card message", () => {
    handlePaymentError(new Error("Your card was declined."));
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith("Card declined. Check your payment method.");
  });

  test("an expired card shows the expired-card message", () => {
    handlePaymentError(new Error("This card has expired."));
    expect(toastError).toHaveBeenCalledWith("Card expired. Try a different card.");
  });

  test("a lowercase '3d secure' failure shows the 3D Secure message", () => {
    handlePaymentError(new Error("3d secure authentication failed."));
    expect(toastError).toHaveBeenCalledWith("3D Secure verification failed. Try a different card.");
  });

  test("an uppercase '3D Secure' failure also shows the 3D Secure message (case-insensitive)", () => {
    handlePaymentError(new Error("3D Secure authentication failed."));
    expect(toastError).toHaveBeenCalledWith("3D Secure verification failed. Try a different card.");
  });

  test("an unrecognized Error message passes through verbatim", () => {
    handlePaymentError(new Error("Stripe: card_error - insufficient_funds"));
    expect(toastError).toHaveBeenCalledWith("Stripe: card_error - insufficient_funds");
  });

  test("a non-Error input falls back to the generic payment-failed message", () => {
    handlePaymentError("some string, not an Error instance");
    expect(toastError).toHaveBeenCalledWith("Payment failed");
  });
});

describe("handleAuthError", () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  test("invalid credentials shows the invalid-login message", () => {
    handleAuthError(new Error("invalid credentials"));
    expect(toastError).toHaveBeenCalledWith("Invalid email or password.");
  });

  test("user not found shows the no-account message", () => {
    handleAuthError(new Error("user not found"));
    expect(toastError).toHaveBeenCalledWith("No account found. Create one first.");
  });

  test("email not confirmed shows the confirm-email message", () => {
    handleAuthError(new Error("email not confirmed"));
    expect(toastError).toHaveBeenCalledWith("Check your email to confirm your account.");
  });

  test("an unrecognized Error message passes through verbatim", () => {
    handleAuthError(new Error("Supabase: unexpected_failure"));
    expect(toastError).toHaveBeenCalledWith("Supabase: unexpected_failure");
  });

  test("a non-Error input falls back to the generic auth-failed message", () => {
    handleAuthError({ code: 500 });
    expect(toastError).toHaveBeenCalledWith("Authentication failed");
  });
});

describe("handleWebhookError", () => {
  let errorSpy: ReturnType<typeof mock>;
  let warnSpy: ReturnType<typeof mock>;
  let originalError: typeof console.error;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    originalError = console.error;
    originalWarn = console.warn;
    errorSpy = mock(() => {});
    warnSpy = mock(() => {});
    console.error = errorSpy as unknown as typeof console.error;
    console.warn = warnSpy as unknown as typeof console.warn;
    toastError.mockClear();
  });

  afterEach(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });

  test("a signature failure logs a security error and never shows a customer toast", () => {
    handleWebhookError(new Error("Webhook signature verification failed"));
    expect(errorSpy).toHaveBeenCalledWith("[SECURITY] Invalid webhook signature");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  test("a 'not found' event logs a duplicate-event warning, not an error", () => {
    handleWebhookError(new Error("Event not found"));
    expect(warnSpy).toHaveBeenCalledWith("[WEBHOOK] Event not found (duplicate?)");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("an unrecognized webhook error logs the raw message as a plain error", () => {
    handleWebhookError(new Error("Unhandled Stripe event type"));
    expect(errorSpy).toHaveBeenCalledWith("[WEBHOOK]", "Unhandled Stripe event type");
  });

  test("a non-Error input falls back to the generic webhook-failed message", () => {
    handleWebhookError(12345);
    expect(errorSpy).toHaveBeenCalledWith("[WEBHOOK]", "Webhook failed");
  });
});
