/**
 * Turn a Supabase auth failure into a sentence a visitor can act on.
 *
 * Supabase reports most problems as `AuthApiError`s with terse server strings
 * ("Invalid login credentials"), and network/CORS/offline failures as fetch
 * errors ("Failed to fetch", "Load failed"). Surfacing those raw made a broken
 * sign-in look like the form was ignoring the user. Unknown messages are still
 * shown verbatim — hiding them would hide real misconfiguration.
 */
export function describeAuthError(err: unknown, fallback: string): string {
  return classifyAuthError(err, fallback).message;
}

/**
 * Coarse category of an auth failure, for UI that needs to do more than show
 * a sentence (e.g. offer "Forgot password?" only when the password was wrong).
 * The wording for each kind lives in `classifyAuthError`; keep the two in sync.
 */
export type AuthErrorKind =
  | "network"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "already_registered"
  | "rate_limited"
  | "provider_disabled"
  | "unavailable"
  | "unknown";

export interface ClassifiedAuthError {
  kind: AuthErrorKind;
  message: string;
}

export function classifyAuthError(err: unknown, fallback: string): ClassifiedAuthError {
  const raw = extractMessage(err);
  if (!raw) return { kind: "unknown", message: fallback };
  const message = raw.trim();
  const lower = message.toLowerCase();

  if (
    /failed to fetch|load failed|networkerror|network request failed|fetch failed|err_network|err_internet_disconnected/.test(
      lower,
    ) ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  ) {
    return {
      kind: "network",
      message: "Can't reach the sign-in service right now. Check your connection and try again.",
    };
  }
  if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials")) {
    return {
      kind: "invalid_credentials",
      message: "Incorrect email or password. Check both and try again, or use “Forgot password?”.",
    };
  }
  if (lower.includes("email not confirmed")) {
    return {
      kind: "email_not_confirmed",
      message: "Confirm your email first — open the link we sent you, then sign in.",
    };
  }
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return {
      kind: "already_registered",
      message: "An account with this email already exists. Sign in instead, or reset your password.",
    };
  }
  if (lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("over_request_rate_limit")) {
    return { kind: "rate_limited", message: "Too many attempts in a row. Wait a minute, then try again." };
  }
  if (lower.includes("provider is not enabled") || lower.includes("unsupported provider")) {
    return {
      kind: "provider_disabled",
      message: "That sign-in provider isn't available right now — use your email and password instead.",
    };
  }
  if (lower.includes("missing supabase environment")) {
    return {
      kind: "unavailable",
      message: "Sign-in isn't available on this deployment right now. Please try again later.",
    };
  }
  return { kind: "unknown", message };
}

function extractMessage(err: unknown): string | undefined {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const candidate = (err as { message?: unknown; error_description?: unknown }).message ??
      (err as { error_description?: unknown }).error_description;
    if (typeof candidate === "string") return candidate;
  }
  return undefined;
}
