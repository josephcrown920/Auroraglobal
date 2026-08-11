import { toast } from "sonner";

/**
 * Error toast helpers for common generation/payment/credit failures.
 * Used throughout the app for consistent error messaging.
 */

export type GenErrorKind =
  | "insufficient_aura"
  | "daily_limit_reached"
  | "no_workers"
  | "out_of_credit"
  | "rate_limited"
  | "timeout"
  | "provider"
  | "unknown";

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

/**
 * Classify a generation failure into a known, customer-safe category. Order
 * matters: more specific signals (out-of-credit) are checked before the broader
 * rate-limit bucket they overlap with.
 */
export function classifyGenerationError(error: unknown): GenErrorKind {
  const msg = rawMessage(error).toLowerCase();
  if (!msg) return "unknown";

  // The user's own opt-in daily Aura cap (cost-guardrails.server.ts /
  // reserve_credits RPC) — check before the broader "unsupported" bucket below,
  // which would otherwise swallow this message.
  if (msg.includes("daily_limit_reached")) {
    return "daily_limit_reached";
  }
  // The customer's own Aura balance (internal), not a provider issue.
  if (msg.includes("insufficient credits") || msg.includes("not enough aura")) {
    return "insufficient_aura";
  }
  // Self-hosted-only features (lip-sync / motion) with no worker online.
  if (msg.includes("no gpu worker") || msg.includes("all gpu workers failed")) {
    return "no_workers";
  }
  // Provider account out of funds — Replicate returns a 429 mentioning a low
  // balance ("...reduced to 6 requests per minute while you have less than $5.0
  // in credit..."). Treat this distinctly from a plain throttle.
  if (
    (msg.includes("429") || msg.includes("rate limit") || msg.includes("too many requests")) &&
    (msg.includes("less than $") ||
      msg.includes("in credit") ||
      msg.includes("out of credit") ||
      msg.includes("insufficient funds"))
  ) {
    return "out_of_credit";
  }
  // Provider account locked / drained — fal returns a 403 "User is locked.
  // Reason: Exhausted balance…", Replicate a 402 "Insufficient credit". These
  // are byte-exact substrings of the real provider responses (lowercased).
  if (
    msg.includes("exhausted balance") ||
    msg.includes("user is locked") ||
    msg.includes("insufficient credit to run") ||
    msg.includes("top up your balance")
  ) {
    return "out_of_credit";
  }
  // Generic provider throttle / rate limit.
  if (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("throttl") ||
    /reduced to \d+ requests?/.test(msg)
  ) {
    return "rate_limited";
  }
  if (msg.includes("timeout") || msg.includes("timed out")) return "timeout";
  if (
    msg.includes("provider error") ||
    msg.includes("replicate create failed") ||
    msg.includes("replicate poll failed") ||
    msg.includes("no provider available") ||
    msg.includes("all providers failed")
  ) {
    return "provider";
  }
  // Owner misconfiguration: the selected model/route isn't usable.
  if (
    msg.includes("no replicate mapping") ||
    msg.includes("no text model mapping") ||
    msg.includes("unsupported") ||
    msg.includes("no path for kind")
  ) {
    return "provider";
  }
  // GPU worker pool call failed ("worker <name> -> 500", "worker <name> FAILED: …").
  if (msg.startsWith("worker ")) return "provider";
  // Generic provider HTTP failure: every hosted adapter throws
  // "<Provider> <status>: <body>" (e.g. "Kling 500: {…}", "Fal 503: …",
  // "Lovable AI 500: …", plain "500: …"). These embed raw provider responses, so
  // map them to a safe message instead of leaking the dump. (429 / low-balance
  // are already handled above.)
  const looksLikeProviderDump =
    /(^|\s)\d{3}\s*:/.test(msg) ||
    /->\s*\d{3}\b/.test(msg) ||
    msg.includes("{") ||
    msg.includes("}");
  if (looksLikeProviderDump) {
    if (msg.includes("402")) return "out_of_credit";
    return "provider";
  }
  return "unknown";
}

const GEN_MESSAGES: Record<Exclude<GenErrorKind, "unknown">, string> = {
  insufficient_aura: "Not enough Aura. Top up to generate.",
  daily_limit_reached: "You've hit your daily Aura limit for today.",
  no_workers: "This feature needs a GPU worker online. Try again once a worker is connected.",
  out_of_credit: "The AI service is busy right now. Please wait a moment and try again.",
  rate_limited: "The image/video service is busy right now. Please wait a moment and try again.",
  timeout: "Generation took too long. Try a simpler prompt.",
  provider: "AI provider is temporarily unavailable. Try a different model.",
};

/**
 * Map any generation error into a clear, customer-safe message. Never returns a
 * raw provider JSON dump for a recognized failure; falls back to the original
 * message only for unrecognized errors (which are app-authored and safe to show,
 * e.g. "Generate a base shot first").
 */
export function friendlyGenerationMessage(error: unknown): string {
  const kind = classifyGenerationError(error);
  if (kind === "unknown") return rawMessage(error) || "Generation failed";
  return GEN_MESSAGES[kind];
}

export function handleGenerationError(error: unknown) {
  const kind = classifyGenerationError(error);
  if (kind === "insufficient_aura") {
    toast.error(GEN_MESSAGES.insufficient_aura, {
      action: { label: "Buy Aura", onClick: () => (window.location.href = "/dashboard/billing") },
    });
    return;
  }
  if (kind === "daily_limit_reached") {
    toast.error(GEN_MESSAGES.daily_limit_reached, {
      action: { label: "Manage limit", onClick: () => (window.location.href = "/dashboard/billing") },
    });
    return;
  }
  if (kind === "out_of_credit") {
    // Operational signal for the owner (not shown to the customer): the provider
    // account needs funding. The customer just sees a "busy, try again" message.
    console.error(
      "[PROVIDER] Generation provider returned an out-of-credit / low-balance throttle — top up the provider account.",
      rawMessage(error),
    );
  }
  toast.error(friendlyGenerationMessage(error));
}

export function handlePaymentError(error: unknown) {
  const msg = error instanceof Error ? error.message : "Payment failed";

  if (msg.includes("declined")) {
    toast.error("Card declined. Check your payment method.");
  } else if (msg.includes("expired")) {
    toast.error("Card expired. Try a different card.");
  } else if (msg.toLowerCase().includes("3d")) {
    toast.error("3D Secure verification failed. Try a different card.");
  } else {
    toast.error(msg);
  }
}

export function handleAuthError(error: unknown) {
  const msg = error instanceof Error ? error.message : "Authentication failed";

  if (msg.includes("invalid credentials")) {
    toast.error("Invalid email or password.");
  } else if (msg.includes("user not found")) {
    toast.error("No account found. Create one first.");
  } else if (msg.includes("email not confirmed")) {
    toast.error("Check your email to confirm your account.");
  } else {
    toast.error(msg);
  }
}

export function handleWebhookError(error: unknown) {
  const msg = error instanceof Error ? error.message : "Webhook failed";

  if (msg.includes("signature")) {
    console.error("[SECURITY] Invalid webhook signature");
  } else if (msg.includes("not found")) {
    console.warn("[WEBHOOK] Event not found (duplicate?)");
  } else {
    console.error("[WEBHOOK]", msg);
  }
}
