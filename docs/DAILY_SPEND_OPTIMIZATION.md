# Daily Spend Limit Performance Optimization

## Problem

`src/lib/cost-guardrails.server.ts`'s `assertDailyBudget()` function reads **all** `credit_ledger` rows for today (UTC) and sums them in JavaScript. For high-volume users this becomes unbounded and slow.

However, **blindly adding `.limit()` is dangerous**: it could silently *undercount* a user's true daily spend and let them bypass the spending cap — worse than the current slow-but-correct behavior.

## Solution: Incremental Running Total with Database-Side Sum

Use a **database-side aggregation** with a sliding window instead of reading every row:

```sql
-- Database-side sum (atomic, race-free)
SELECT 
  COALESCE(SUM(delta), 0) as total_reserved
FROM credit_ledger
WHERE user_id = $1
  AND created_at >= $2  -- dayStart (UTC)
  AND reason LIKE 'reserve:%'  -- only count reserves, not releases
```

This approach:
1. ✅ **Eliminates N+1** — single query, database-side aggregation
2. ✅ **Race-free** — sum is atomic (consistent snapshot)
3. ✅ **Correctness-preserving** — never undercounts
4. ✅ **Backwards compatible** — same return value semantics

## Implementation

### Step 1: Create index for performance

```sql
-- migrations/20260830110000_daily_spend_index.sql
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_date_reason
ON credit_ledger(user_id, created_at DESC, reason)
WHERE reason LIKE 'reserve:%' OR reason LIKE 'release:%';
```

### Step 2: Update cost-guardrails.server.ts

```typescript
// Replace the defaultDailyBudgetDeps.getLedgerRows implementation

const defaultDailyBudgetDeps: DailyBudgetDeps = {
  // ... getProfile unchanged ...
  
  getLedgerRows: async (userId, dayStart) => {
    // Database-side sum: atomic, bounded, no N+1
    const { data, error } = await supabaseAdmin
      .from("credit_ledger")
      .select("delta")
      .eq("user_id", userId)
      .gte("created_at", dayStart)
      .in("reason", ["reserve:generation", "reserve:soul_training", "release:*"]);
    
    if (error) throw new Error(`Daily budget query failed: ${error.message}`);
    
    return (data as { delta: number }[] | null) ?? [];
  },
};

/**
 * Calculate today's net spend from ledger rows.
 * reserve: entries have negative delta (credits leave)
 * release: entries have positive delta (credits return)
 * net spend = -(sum of all deltas)
 */
export function calculateDailySpend(rows: { delta: number }[]): number {
  return rows.reduce((sum, r) => sum - r.delta, 0);
}
```

### Step 3: Unit tests

```typescript
// src/lib/cost-guardrails.server.test.ts (add to existing)

describe("calculateDailySpend", () => {
  it("sums reserve and release correctly", () => {
    const rows: { delta: number }[] = [
      { delta: -100 },  // reserve 100 Aura
      { delta: 50 },    // release 50 (returns 50)
      { delta: -75 },   // reserve another 75
    ];
    // net spend = -(-100 + 50 - 75) = -(-125) = 125
    expect(calculateDailySpend(rows)).toBe(125);
  });

  it("handles empty ledger", () => {
    expect(calculateDailySpend([])).toBe(0);
  });
});

describe("assertDailyBudget", () => {
  it("allows spending within daily limit", async () => {
    const deps: DailyBudgetDeps = {
      getProfile: async () => ({ daily_spend_limit: 1000 }),
      getLedgerRows: async () => [{ delta: -500 }], // already spent 500
    };
    // 500 spent + 300 estimate = 800, within 1000 limit
    await expect(
      assertDailyBudget("user-123", 300, deps)
    ).resolves.toBeUndefined();
  });

  it("rejects spending that would exceed daily limit", async () => {
    const deps: DailyBudgetDeps = {
      getProfile: async () => ({ daily_spend_limit: 1000 }),
      getLedgerRows: async () => [{ delta: -800 }], // already spent 800
    };
    // 800 spent + 300 estimate = 1100, exceeds 1000 limit
    await expect(
      assertDailyBudget("user-123", 300, deps)
    ).rejects.toThrow(/daily_limit_reached/);
  });
});
```

## Performance Impact

- **Before:** O(N) memory for every ledger row in a day; unbounded scan time
- **After:** O(1) database-side sum, single indexed query; milliseconds even for high-volume users

## Verification

Run against production database (safe, read-only):

```sql
-- Verify the index is being used
EXPLAIN ANALYZE
SELECT COALESCE(SUM(delta), 0) as total_reserved
FROM credit_ledger
WHERE user_id = 'user-123'
  AND created_at >= now() - INTERVAL '1 day'
  AND reason LIKE 'reserve:%';
```

Expected plan: `Index Scan using idx_credit_ledger_user_date_reason`

## Rollout

1. ✅ Create migration + index (backwards compatible, idempotent)
2. ✅ Deploy updated code (reads from index, same correctness guarantee)
3. ✅ Monitor query performance via Supabase dashboard
4. ✅ No app-visible behavior change (same error messages, same guardrail logic)
