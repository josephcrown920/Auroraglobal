// Single source of truth for how each Paystack purchase is split between
// owner profit and the credit-funding portion. Change PROFIT_SPLIT_PCT here
// and every place that reports earnings (webhook accounting + admin dashboard)
// stays in sync. Mirrors the 60/40 model from the ai-credit-system bundle.
export const PROFIT_SPLIT_PCT = 60;
export const CREDIT_FUNDING_PCT = 100 - PROFIT_SPLIT_PCT;

export interface ProfitSplit {
  /** Gross charged amount in the currency's minor unit (e.g. USD cents). */
  gross_minor: number;
  /** Owner profit portion in minor units. */
  profit_minor: number;
  /** Credit-funding portion in minor units. */
  credit_funding_minor: number;
  /** Profit percentage applied at the time of the split. */
  profit_pct: number;
}

/**
 * Split a gross charge into owner profit and credit-funding portions using the
 * single configurable PROFIT_SPLIT_PCT. Profit is rounded and the remainder is
 * the credit-funding portion so the two always sum back to the gross exactly.
 */
export function computeProfitSplit(grossMinor: number): ProfitSplit {
  const gross = Math.max(0, Math.round(grossMinor || 0));
  const profit_minor = Math.round(gross * (PROFIT_SPLIT_PCT / 100));
  const credit_funding_minor = gross - profit_minor;
  return { gross_minor: gross, profit_minor, credit_funding_minor, profit_pct: PROFIT_SPLIT_PCT };
}
