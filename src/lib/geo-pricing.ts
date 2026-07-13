/**
 * Geo-based pricing — client-safe module.
 *
 * Detects the user's region from browser timezone + locale and maps it to a
 * Paystack-supported currency with regionally-adjusted prices (PPP).
 *
 * Rules:
 *  - Aura credit amounts are the SAME in every region.
 *  - Only the real-money price changes — cheaper in emerging markets.
 *  - Paystack-supported currencies only: NGN, GHS, ZAR, KES, EGP, USD.
 *  - Falls back to USD for any unrecognised timezone/locale.
 *  - IMPORTANT: Each user only ever sees their own region's price.
 *    Never expose cross-region prices in any UI.
 */

export type GeoCurrency = "USD" | "NGN" | "GHS" | "ZAR" | "KES" | "EGP";

export interface GeoRegion {
  currency: GeoCurrency;
  symbol: string;
  name: string;
  /** Starter / Creator / Studio one-time Aura pack prices (Paystack minor units). */
  packs: {
    starter: { amount_minor: number; display: string };
    creator: { amount_minor: number; display: string };
    studio:  { amount_minor: number; display: string };
  };
  /** Pro monthly subscription price (Paystack minor units). */
  proMonthly: { amount_minor: number; display: string };
}

/**
 * USD target prices:
 *   Pro monthly = $15
 *   Starter pack = $10 | Creator pack = $30 | Studio pack = $80
 *
 * Emerging-market target prices (PPP ~67% of USD):
 *   Pro monthly ≈ $10 USD equivalent
 *   Packs       ≈ $6.50 / $20 / $53 USD equivalent
 *
 * Exchange rates used (mid-2025 approximate):
 *   NGN 1,550 / USD  |  GHS 15.5 / USD  |  KES 130 / USD
 *   ZAR 18.5 / USD   |  EGP 49 / USD
 */
const REGIONS: Record<GeoCurrency, GeoRegion> = {
  USD: {
    currency: "USD", symbol: "$", name: "International",
    packs: {
      starter: { amount_minor: 10_00,  display: "$10" },
      creator: { amount_minor: 30_00,  display: "$30" },
      studio:  { amount_minor: 80_00,  display: "$80" },
    },
    proMonthly: { amount_minor: 15_00, display: "$15/mo" },
  },

  NGN: {
    currency: "NGN", symbol: "₦", name: "Nigeria",
    packs: {
      // ~$6.50 / $20 / $53 at ₦1,550/USD
      starter: { amount_minor:  9_750_00,  display: "₦9,750" },
      creator: { amount_minor: 31_000_00,  display: "₦31,000" },
      studio:  { amount_minor: 82_000_00,  display: "₦82,000" },
    },
    // ~$10 at ₦1,550/USD
    proMonthly: { amount_minor: 15_500_00, display: "₦15,500/mo" },
  },

  GHS: {
    currency: "GHS", symbol: "₵", name: "Ghana",
    packs: {
      // ~$6.50 / $20 / $53 at ₵15.5/USD
      starter: { amount_minor:  100_00,  display: "₵100" },
      creator: { amount_minor:  310_00,  display: "₵310" },
      studio:  { amount_minor:  820_00,  display: "₵820" },
    },
    // ~$10 at ₵15.5/USD
    proMonthly: { amount_minor: 155_00, display: "₵155/mo" },
  },

  KES: {
    currency: "KES", symbol: "KES", name: "Kenya",
    packs: {
      // ~$6.50 / $20 / $53 at KES 130/USD
      starter: { amount_minor:  845_00,    display: "KES 845" },
      creator: { amount_minor:  2_600_00,  display: "KES 2,600" },
      studio:  { amount_minor:  6_890_00,  display: "KES 6,890" },
    },
    // ~$10 at KES 130/USD
    proMonthly: { amount_minor: 1_300_00, display: "KES 1,300/mo" },
  },

  ZAR: {
    currency: "ZAR", symbol: "R", name: "South Africa",
    packs: {
      // ~$6.50 / $20 / $53 at R18.5/USD
      starter: { amount_minor:  120_00,  display: "R120" },
      creator: { amount_minor:  370_00,  display: "R370" },
      studio:  { amount_minor:  980_00,  display: "R980" },
    },
    // ~$10 at R18.5/USD
    proMonthly: { amount_minor: 185_00, display: "R185/mo" },
  },

  EGP: {
    currency: "EGP", symbol: "EGP", name: "Egypt",
    packs: {
      // ~$6.50 / $20 / $53 at EGP 49/USD
      starter: { amount_minor:  318_00,   display: "EGP 318" },
      creator: { amount_minor:  980_00,   display: "EGP 980" },
      studio:  { amount_minor:  2_597_00, display: "EGP 2,597" },
    },
    // ~$10 at EGP 49/USD
    proMonthly: { amount_minor: 490_00, display: "EGP 490/mo" },
  },
};

/** Africa/Lagos, Africa/Accra, etc → currency */
const TZ_TO_CURRENCY: Record<string, GeoCurrency> = {
  "Africa/Lagos":        "NGN",
  "Africa/Abuja":        "NGN",
  "Africa/Accra":        "GHS",
  "Africa/Nairobi":      "KES",
  "Africa/Johannesburg": "ZAR",
  "Africa/Cairo":        "EGP",
};

/** Locale country component → currency (for when timezone is ambiguous). */
const LOCALE_TO_CURRENCY: Record<string, GeoCurrency> = {
  NG: "NGN",
  GH: "GHS",
  KE: "KES",
  ZA: "ZAR",
  EG: "EGP",
};

/**
 * Detect the user's geo region from browser APIs.
 * SSR-safe: returns USD when called outside a browser environment.
 */
export function detectGeoRegion(): GeoRegion {
  if (typeof window === "undefined" || typeof Intl === "undefined") {
    return REGIONS.USD;
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    const tzCurrency = TZ_TO_CURRENCY[tz];
    if (tzCurrency) return REGIONS[tzCurrency];

    const lang = navigator.language ?? "";
    const country = lang.includes("-") ? lang.split("-").pop()?.toUpperCase() ?? "" : "";
    const localeCurrency = LOCALE_TO_CURRENCY[country];
    if (localeCurrency) return REGIONS[localeCurrency];
  } catch {
    // Permissions / feature detection error — fall through to USD
  }

  return REGIONS.USD;
}

export { REGIONS };
