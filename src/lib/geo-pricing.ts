/**
 * Geo-based pricing — client-safe module.
 *
 * Detects the user's region from browser timezone + locale and maps it to a
 * Paystack-supported currency and regionally-adjusted Aura pack prices (PPP).
 *
 * Rules:
 *  - Aura credit amounts (80 / 240 / 640) are the SAME in every region.
 *  - Only the real-money price changes — cheaper in emerging markets.
 *  - Paystack-supported currencies only: NGN, GHS, ZAR, KES, EGP, USD.
 *  - Falls back to USD for any unrecognised timezone/locale.
 */

export type GeoCurrency = "USD" | "NGN" | "GHS" | "ZAR" | "KES" | "EGP";

export interface GeoRegion {
  currency: GeoCurrency;
  symbol: string;
  name: string;
  /** Starter / Creator / Studio prices in currency minor units (e.g. kobo, pesewas). */
  packs: {
    starter: { amount_minor: number; display: string };
    creator: { amount_minor: number; display: string };
    studio:  { amount_minor: number; display: string };
  };
  proMonthly: { amount_minor: number; display: string };
}

/** Paystack requires amounts in the smallest unit of the currency. */
const REGIONS: Record<GeoCurrency, GeoRegion> = {
  NGN: {
    currency: "NGN", symbol: "₦", name: "Nigeria",
    packs: {
      starter: { amount_minor: 7_500_00, display: "₦7,500" },
      creator: { amount_minor: 22_500_00, display: "₦22,500" },
      studio:  { amount_minor: 60_000_00, display: "₦60,000" },
    },
    proMonthly: { amount_minor: 11_250_00, display: "₦11,250/mo" },
  },
  GHS: {
    currency: "GHS", symbol: "₵", name: "Ghana",
    packs: {
      starter: { amount_minor: 130_00, display: "₵130" },
      creator: { amount_minor: 390_00, display: "₵390" },
      studio:  { amount_minor: 1_040_00, display: "₵1,040" },
    },
    proMonthly: { amount_minor: 195_00, display: "₵195/mo" },
  },
  KES: {
    currency: "KES", symbol: "KES", name: "Kenya",
    packs: {
      starter: { amount_minor: 1_300_00, display: "KES 1,300" },
      creator: { amount_minor: 3_900_00, display: "KES 3,900" },
      studio:  { amount_minor: 10_400_00, display: "KES 10,400" },
    },
    proMonthly: { amount_minor: 1_950_00, display: "KES 1,950/mo" },
  },
  ZAR: {
    currency: "ZAR", symbol: "R", name: "South Africa",
    packs: {
      starter: { amount_minor: 185_00, display: "R185" },
      creator: { amount_minor: 555_00, display: "R555" },
      studio:  { amount_minor: 1_480_00, display: "R1,480" },
    },
    proMonthly: { amount_minor: 278_00, display: "R278/mo" },
  },
  EGP: {
    currency: "EGP", symbol: "EGP", name: "Egypt",
    packs: {
      starter: { amount_minor: 485_00, display: "EGP 485" },
      creator: { amount_minor: 1_455_00, display: "EGP 1,455" },
      studio:  { amount_minor: 3_880_00, display: "EGP 3,880" },
    },
    proMonthly: { amount_minor: 728_00, display: "EGP 728/mo" },
  },
  USD: {
    currency: "USD", symbol: "$", name: "International",
    packs: {
      starter: { amount_minor: 10_00, display: "$10" },
      creator: { amount_minor: 30_00, display: "$30" },
      studio:  { amount_minor: 80_00, display: "$80" },
    },
    proMonthly: { amount_minor: 15_00, display: "$15/mo" },
  },
};

/** Africa/Lagos, Africa/Accra, etc → two-letter country code heuristic */
const TZ_TO_CURRENCY: Record<string, GeoCurrency> = {
  // Nigeria
  "Africa/Lagos":   "NGN",
  "Africa/Abuja":   "NGN",
  // Ghana
  "Africa/Accra":   "GHS",
  // Kenya
  "Africa/Nairobi": "KES",
  // South Africa
  "Africa/Johannesburg": "ZAR",
  // Egypt
  "Africa/Cairo":   "EGP",
};

/** Locale's country component → currency (for when timezone is ambiguous). */
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

    // Try navigator.language locale region (e.g. "en-NG" → "NG")
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
