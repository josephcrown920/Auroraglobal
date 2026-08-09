export type PackKey = "starter" | "creator" | "studio";

/**
 * Decides whether clicking a pack's buy button should first show the inline
 * "this pack won't fund a full Perform Anywhere render — continue?" step.
 *
 * The confirmation is shown exactly when the card is already showing the
 * amber performance warning (the pack cannot fund a single representative
 * Perform Anywhere render) AND the user has not yet acknowledged it for this
 * pack. It never blocks the purchase — the second click always proceeds.
 */
export function shouldConfirmPackPurchase(input: {
  /** How many representative Perform Anywhere renders the pack can fund. */
  performanceCount: number;
  /** Pack the user has already acknowledged the warning for (if any). */
  confirmedKey: PackKey | null;
  /** Pack being purchased. */
  key: PackKey;
}): boolean {
  return input.performanceCount === 0 && input.confirmedKey !== input.key;
}
