// Shared helper for user-facing API error responses.
//
// Some caught errors are safe to show verbatim (Zod input-validation
// messages describing the caller's own malformed request, or a provider's
// own status message about the caller's own resource). Others originate from
// our infrastructure — raw Postgres/RPC error text, internal fetch
// exceptions, stack traces — and must never reach the client: they can leak
// schema/constraint names, internal hostnames, or other implementation
// detail. This helper logs the full original error server-side (so
// debugging is unaffected) and returns a generic, safe message to the caller.
export function safeErrorMessage(context: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[${context}]`, detail);
  return "Something went wrong on our end — please try again.";
}
