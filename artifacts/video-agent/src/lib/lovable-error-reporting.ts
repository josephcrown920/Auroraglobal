// No-op stub — error reporting runs through Aurora's own logging pipeline.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function reportLovableError(_error: unknown, _context?: Record<string, unknown>): void {
  // intentionally empty
}
