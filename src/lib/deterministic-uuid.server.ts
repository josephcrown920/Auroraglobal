import { createHash } from "crypto";

/** Deterministic UUID from an arbitrary string — used as an idempotency ref
 *  for credit grants (same input always yields the same ledger ref_id). */
export function deterministicUuid(input: string): string {
  const hash = createHash("md5").update(input).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}
