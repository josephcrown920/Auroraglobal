// Shared authorization for recurring/scheduled endpoints (worker tick, health).
//
// Recurring work is triggered EXTERNALLY (a Supabase dashboard pg_cron job) on
// Replit autoscale, which is request-driven and has no durable in-process timer.
// We accept two credentials so the auth can be hardened without an outage:
//   1. CRON_SECRET  — preferred, a server-only shared secret (fail-closed).
//   2. the Supabase anon/publishable key — legacy, what the existing dashboard
//      cron job already sends; kept for backward compatibility.
//
// Pass either as the `apikey` header or as `Authorization: Bearer <value>`.

export function extractCronCredential(request: Request): string | null {
  return (
    request.headers.get("apikey") ||
    request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ||
    null
  );
}

/**
 * Returns true when the request carries a valid scheduler credential. Fails
 * closed when neither a CRON_SECRET nor an anon key is configured.
 */
export function authorizeCron(request: Request): boolean {
  const provided = extractCronCredential(request);
  if (!provided) return false;

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && provided === cronSecret) return true;

  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (anonKey && provided === anonKey) return true;

  return false;
}

/**
 * Strict variant for endpoints with real-world side effects (e.g. sending
 * emails): once CRON_SECRET is configured, ONLY that secret is accepted —
 * the Supabase anon/publishable key is embedded in every browser bundle and
 * must not be able to trigger side-effectful work. Until CRON_SECRET exists
 * it falls back to the legacy shared credential so the scheduler keeps
 * running (harden-without-outage, same policy as authorizeCron).
 */
export function authorizeCronStrict(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    return extractCronCredential(request) === cronSecret;
  }
  return authorizeCron(request);
}
