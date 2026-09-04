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
  const raw = extractMessage(err);
  if (!raw) return fallback;
  const message = raw.trim();
  const lower = message.toLowerCase();

  if (
    /failed to fetch|load failed|networkerror|network request failed|fetch failed|err_network|err_internet_disconnected/.test(
      lower,
    ) ||
    (typeof navigator !== "undefined" && navigator.onLine === false)
  ) {
    return "Can't reach the sign-in service right now. Check your connection and try again.";
  }
  if (lower.includes("invalid login credentials") || lower.includes("invalid_credentials")) {
    return "Incorrect email or password. Check both and try again, or use “Forgot password?”.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email first — open the link we sent you, then sign in.";
  }
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Sign in instead, or reset your password.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("over_request_rate_limit")) {
    return "Too many attempts in a row. Wait a minute, then try again.";
  }
  if (lower.includes("provider is not enabled") || lower.includes("unsupported provider")) {
    return "That sign-in provider isn't available right now — use your email and password instead.";
  }
  if (lower.includes("missing supabase environment")) {
    return "Sign-in isn't available on this deployment right now. Please try again later.";
  }
  return message;
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
