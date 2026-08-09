// Pure predicate for the Admin → Workers "auto-registration disabled" warning.
// Client-safe (no server imports) so admin.lazy.tsx and unit tests share the
// exact same logic.
//
// The warning must fire in BOTH situations:
//  1. `registerSecretConfigured === false` — the server told us outright that
//     AURORA_REGISTER_SECRET is unset. This covers the critical no-attempt
//     case: an operator who hasn't configured the secret yet sees the hint
//     BEFORE any worker ever tries (and fails) to register.
//  2. A recorded registration attempt failed with the exact server-disabled
//     audit error — covers older data or a server function that predates the
//     `registerSecretConfigured` field (undefined ≠ false, so stale clients
//     don't false-positive).
export const REGISTER_DISABLED_ERROR =
  "Registration disabled: AURORA_REGISTER_SECRET is not configured";

export function shouldShowRegisterSecretWarning(
  registerSecretConfigured: boolean | undefined,
  attempts: ReadonlyArray<Record<string, unknown>>,
): boolean {
  if (registerSecretConfigured === false) return true;
  return attempts.some((a) => a.ok === false && a.error === REGISTER_DISABLED_ERROR);
}
