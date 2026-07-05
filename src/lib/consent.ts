// Lightweight cookie/analytics consent gate for GDPR (EU), UK GDPR, and
// CA (PIPEDA/CPPA) visitors. There is no IP-geolocation backend in this
// project (see geo.functions.ts, which is a USD-only stub), so region is
// inferred client-side from the browser locale and timezone — a common,
// zero-infra heuristic. It is not perfectly precise, but it errs toward
// showing the banner (never toward silently skipping consent) for anyone
// who looks EU/UK/CA-ish.

export type ConsentStatus = "accepted" | "declined";

const CONSENT_STORAGE_KEY = "aurora.cookie_consent.v1";
// Bump this if the consent copy/scope materially changes, to re-ask users.
const CONSENT_VERSION = "2026-07-05";

type StoredConsent = { status: ConsentStatus; version: string; ts: number };

// EU member states + UK + EEA (Iceland/Liechtenstein/Norway) — GDPR / UK GDPR.
const EU_UK_EEA_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE", "GB", "IS", "LI", "NO",
]);
const CA_COUNTRY_CODE = "CA";

// IANA timezones covering the EU/UK/EEA and Canada, used as a fallback
// signal when the browser locale doesn't carry a region subtag.
const CANADA_TIMEZONES = new Set([
  "America/St_Johns", "America/Halifax", "America/Moncton", "America/Glace_Bay",
  "America/Goose_Bay", "America/Blanc-Sablon", "America/Toronto", "America/Nipigon",
  "America/Thunder_Bay", "America/Iqaluit", "America/Pangnirtung", "America/Resolute",
  "America/Atikokan", "America/Rankin_Inlet", "America/Winnipeg", "America/Rainy_River",
  "America/Regina", "America/Swift_Current", "America/Edmonton", "America/Cambridge_Bay",
  "America/Yellowknife", "America/Inuvik", "America/Creston", "America/Dawson_Creek",
  "America/Fort_Nelson", "America/Vancouver", "America/Whitehorse", "America/Dawson",
]);

function isEuUkTimezone(tz: string): boolean {
  return (
    tz.startsWith("Europe/") ||
    tz === "Atlantic/Faroe" ||
    tz === "Atlantic/Canary" ||
    tz === "Atlantic/Madeira" ||
    tz === "Atlantic/Azores" ||
    tz === "Atlantic/Reykjavik"
  );
}

function getLocaleCountryCode(): string | null {
  try {
    const locale =
      typeof navigator !== "undefined"
        ? navigator.language || navigator.languages?.[0]
        : null;
    if (!locale) return null;
    const parts = locale.split("-");
    if (parts.length < 2) return null;
    return parts[parts.length - 1]!.toUpperCase();
  } catch {
    return null;
  }
}

function getTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// Heuristic region check — see module comment. Intentionally conservative
// in the "show banner" direction: any EU/UK/EEA/CA signal from either the
// locale region code or the timezone is enough to require opt-in consent.
export function isRegulatedRegion(): boolean {
  if (typeof window === "undefined") return false;

  const country = getLocaleCountryCode();
  if (country) {
    if (EU_UK_EEA_COUNTRY_CODES.has(country) || country === CA_COUNTRY_CODE) return true;
  }

  const tz = getTimezone();
  if (tz) {
    if (isEuUkTimezone(tz) || CANADA_TIMEZONES.has(tz)) return true;
  }

  return false;
}

function readConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (parsed.status !== "accepted" && parsed.status !== "declined") return null;
    if (parsed.version !== CONSENT_VERSION) return null; // re-ask on version bump
    return parsed as StoredConsent;
  } catch {
    return null;
  }
}

export function getConsentStatus(): ConsentStatus | null {
  return readConsent()?.status ?? null;
}

export function setConsentStatus(status: ConsentStatus): void {
  if (typeof window === "undefined") return;
  try {
    const record: StoredConsent = { status, version: CONSENT_VERSION, ts: Date.now() };
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* ignore storage failures (private mode, quota, etc.) */
  }
}

export function clearConsentStatus(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// Only surface the banner on first visit for visitors in a regulated region
// who haven't already answered it.
export function shouldShowConsentBanner(): boolean {
  if (typeof window === "undefined") return false;
  if (getConsentStatus() !== null) return false;
  return isRegulatedRegion();
}

// Whether non-essential analytics (product-analytics session id + events)
// may run. Declining always blocks analytics everywhere. In a regulated
// region with no answer yet, analytics stays blocked until the visitor
// responds to the banner (opt-in). Outside a regulated region with no
// answer, analytics keeps today's default-on behaviour (implied consent).
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  const status = getConsentStatus();
  if (status === "declined") return false;
  if (status === "accepted") return true;
  return !isRegulatedRegion();
}

// Custom event name the banner listens for so it can be re-opened (e.g. a
// "Cookie preferences" link in the footer) even after a decision was made.
export const OPEN_CONSENT_MANAGER_EVENT = "aurora:open-cookie-consent";

export function openConsentManager(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_CONSENT_MANAGER_EVENT));
}
