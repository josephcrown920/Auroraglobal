// Aurora Partners program constants — CLIENT-SAFE (no .server imports).
// All Partners UI copy must derive from these so displayed numbers can't
// drift from what the server actually grants/pays.

/** Recurring commission on every Aura purchase by a referred user (percent). */
export const PARTNER_COMMISSION_PCT = 35;

/** Aura granted to EACH side (referrer and referee) when a referred signup attaches. */
export const REFERRAL_AURA_EACH = 50;

/** Max referrer-side signup rewards per trailing 24h (anti-farming cap).
 *  Referee grants and referral attribution are never capped. */
export const REFERRAL_REWARD_DAILY_CAP = 10;
