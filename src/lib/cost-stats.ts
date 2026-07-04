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

export type EarningsSeriesInputRow = {
  created_at: string;
  revenueMinor: number;
  profitMinor: number;
};

export type EarningsBucket = {
  bucket: string;
  revenueMinor: number;
  profitMinor: number;
};

/**
 * ISO week key (YYYY-Www, Monday-start) for a given day-string (YYYY-MM-DD).
 * Used to bucket longer ranges by week instead of by day.
 */
function isoWeekKey(dayStr: string): string {
  const d = new Date(`${dayStr}T00:00:00Z`);
  // Shift to nearest Thursday to compute the correct ISO week/year.
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Bucket revenue/profit rows by day (<=60 day span) or ISO week (longer/"all"
 * ranges) so the trend chart doesn't render hundreds of daily points. Sorted
 * ascending by bucket key so it can be plotted left-to-right directly.
 */
export function bucketEarningsSeries(
  rows: EarningsSeriesInputRow[],
  granularity: "day" | "week",
): EarningsBucket[] {
  const map = new Map<string, EarningsBucket>();
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    const bucket = granularity === "week" ? isoWeekKey(day) : day;
    const existing = map.get(bucket);
    if (existing) {
      existing.revenueMinor += r.revenueMinor;
      existing.profitMinor += r.profitMinor;
    } else {
      map.set(bucket, { bucket, revenueMinor: r.revenueMinor, profitMinor: r.profitMinor });
    }
  }
  return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket));
}

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
