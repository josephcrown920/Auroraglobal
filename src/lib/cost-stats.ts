// Pure cost-analytics helpers (no server deps) so tests can import them
// without mocking Supabase.

/**
 * The ONLY status values writers actually use for a finished-successfully
 * generation: the API core writes 'succeeded', studio server fns write
 * 'complete'. Any query that filters "successful generations" must use this
 * list — hand-rolled variants (e.g. 'completed') silently drop rows.
 */
export const GENERATION_SUCCESS_STATUSES = ["succeeded", "complete"] as const;

export type CostStatRow = {
  kind: string | null;
  credits_cost: number | null;
  created_at: string | null;
};

export type DayKindRow = { day: string; kind: string; count: number; totalCredits: number };

/** Group generation rows into per-day/per-kind counts + credit totals. */
export function aggregateByDayKind(rows: CostStatRow[]): DayKindRow[] {
  const map = new Map<string, DayKindRow>();
  for (const g of rows) {
    const day = g.created_at?.slice(0, 10) ?? "unknown";
    const kind = g.kind ?? "unknown";
    const key = `${day}|${kind}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      existing.totalCredits += g.credits_cost ?? 0;
    } else {
      map.set(key, { day, kind, count: 1, totalCredits: g.credits_cost ?? 0 });
    }
  }
  return [...map.values()].sort(
    (a, b) => b.day.localeCompare(a.day) || b.totalCredits - a.totalCredits,
  );
}
