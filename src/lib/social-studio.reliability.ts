/**
 * Client-safe reliability primitives for Marketing Studio.
 *
 * This module intentionally has no server imports. It is safe to use from the
 * lazy route, localStorage validation, and deterministic unit tests.
 */

export type OperationToken = Readonly<{
  key: string;
  epoch: number;
  sequence: number;
}>;

export type OperationFence = {
  begin: (key: string) => OperationToken | null;
  finish: (token: OperationToken) => void;
  isCurrent: (token: OperationToken) => boolean;
  isLocked: (key: string) => boolean;
  invalidate: () => void;
};

/**
 * Synchronous, per-key single-flight fencing for UI operations.
 *
 * `begin` and `invalidate` mutate the lock synchronously, before an async
 * function gets a chance to yield. This makes the fence stronger than a
 * React-state loading flag: a double click, campaign replacement, or unmount
 * cannot leave two completions authorized to mutate the same item.
 */
export function createOperationFence(): OperationFence {
  let epoch = 0;
  let sequence = 0;
  const active = new Map<string, OperationToken>();

  return {
    begin(key) {
      if (active.has(key)) return null;
      const token: OperationToken = Object.freeze({
        key,
        epoch,
        sequence: ++sequence,
      });
      active.set(key, token);
      return token;
    },
    finish(token) {
      if (active.get(token.key) === token) active.delete(token.key);
    },
    isCurrent(token) {
      return token.epoch === epoch && active.get(token.key) === token;
    },
    isLocked(key) {
      return active.has(key);
    },
    invalidate() {
      epoch += 1;
      active.clear();
    },
  };
}

export const CAMPAIGN_PLANNER_OPERATION = "campaign-planner";

export function itemOperationKey(campaignId: string, itemId: string): string {
  return `${campaignId}:${itemId}`;
}

export type VisualGenerationPlan = {
  /** Slot values to preserve before applying this run's settled results. */
  base: Array<string | null>;
  /** Original slot indexes requested by this run. */
  targets: number[];
};

/**
 * Plan visual work without compacting carousel slots.
 *
 * A matching previous slot array means a retry can target only missing slots.
 * If every slot already has a result, the operator explicitly requested a
 * regeneration, so every slot is targeted while the old values remain the
 * fallback if an individual render fails.
 */
export function planVisualGeneration(
  previous: readonly (string | null)[],
  promptCount: number,
): VisualGenerationPlan {
  if (!Number.isInteger(promptCount) || promptCount < 1) {
    throw new Error("promptCount must be a positive integer");
  }

  const hasMatchingSlotCount = previous.length === promptCount;
  const base = hasMatchingSlotCount
    ? Array.from(previous)
    : Array.from({ length: promptCount }, () => null);
  const missing = base.flatMap((url, index) => (url ? [] : [index]));
  const targets = missing.length ? missing : Array.from({ length: promptCount }, (_, index) => index);
  return { base, targets };
}

/**
 * Apply settled generation values to their original carousel slots.
 *
 * `null`/empty results represent failures and deliberately leave the base
 * value intact. When there was no prior successful value, the slot remains
 * explicitly null, making a total failure retryable instead of looking like
 * an unstarted render.
 */
export function applyVisualGenerationResults(
  plan: VisualGenerationPlan,
  results: readonly (string | null | undefined)[],
): Array<string | null> {
  const next = Array.from(plan.base);
  plan.targets.forEach((slot, position) => {
    const result = results[position];
    if (result) next[slot] = result;
  });
  return next;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}