import { toast } from "sonner";

/**
 * Error toast helpers for common generation/payment/credit failures.
 * Used throughout the app for consistent error messaging.
 */

export function handleGenerationError(error: unknown) {
  const msg = error instanceof Error ? error.message : "Generation failed";

  if (msg.includes("insufficient credits")) {
    toast.error("Not enough Aurora. Top up to generate.", {
      action: { label: "Buy Aurora", onClick: () => window.location.href = "/dashboard/billing" },
    });
  } else if (msg.includes("rate limit")) {
    toast.error("Too many requests. Wait a moment and try again.");
  } else if (msg.includes("provider error")) {
    toast.error("AI provider is temporarily unavailable. Try a different model.");
  } else if (msg.includes("timeout")) {
    toast.error("Generation took too long. Try a simpler prompt.");
  } else {
    toast.error(msg);
  }
}

export function handlePaymentError(error: unknown) {
  const msg = error instanceof Error ? error.message : "Payment failed";

  if (msg.includes("declined")) {
    toast.error("Card declined. Check your payment method.");
  } else if (msg.includes("expired")) {
    toast.error("Card expired. Try a different card.");
  } else if (msg.includes("3d")) {
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
