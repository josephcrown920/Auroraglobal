import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  isRegulatedRegion,
  hasAnalyticsConsent,
  setConsentStatus,
  clearConsentStatus,
  getConsentStatus,
} from "./consent";

// ---------------------------------------------------------------------------
// Minimal browser environment helpers
//
// consent.ts guards every function with `typeof window === "undefined"`.
// We stub globalThis.window (just needs to be truthy), navigator.language,
// Intl.DateTimeFormat (for timezone), and localStorage so each test controls
// exactly which signals the heuristic sees.
// ---------------------------------------------------------------------------

type Env = {
  language?: string | null;
  timezone?: string | null;
  storedConsent?: string | null;
};

// Track what we injected so teardown can restore precisely.
let injectedWindow = false;
let injectedNavigator = false;
let injectedIntl = false;
let injectedLocalStorage = false;
let savedIntlDateTimeFormat: typeof Intl.DateTimeFormat;

const CONSENT_KEY = "aurora.cookie_consent.v1";
const CONSENT_VERSION = "2026-07-05";

function makeLocalStorage(initial?: Record<string, string>) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (k: string): string | null => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
}

function setupEnv(env: Env = {}) {
  // window
  if (typeof globalThis.window === "undefined") {
    // @ts-expect-error test-only stub
    globalThis.window = globalThis;
    injectedWindow = true;
  }

  // navigator
  if (env.language !== undefined) {
    const lang = env.language ?? "";
    // @ts-expect-error test-only stub
    globalThis.navigator = { language: lang, languages: lang ? [lang] : [] };
    injectedNavigator = true;
  } else {
    // No locale signal — provide a navigator with no region subtag so the
    // locale branch cannot fire (we then test timezone-only signals).
    // @ts-expect-error test-only stub
    globalThis.navigator = { language: "en", languages: ["en"] };
    injectedNavigator = true;
  }

  // localStorage
  const stored =
    env.storedConsent !== undefined
      ? { [CONSENT_KEY]: env.storedConsent! }
      : {};
  // @ts-expect-error test-only stub
  globalThis.localStorage = makeLocalStorage(stored);
  injectedLocalStorage = true;
  // also wire window.dispatchEvent so setConsentStatus doesn't throw
  // @ts-expect-error test-only stub
  globalThis.window.dispatchEvent = () => {};
  // @ts-expect-error test-only stub
  globalThis.dispatchEvent = () => {};

  // Intl.DateTimeFormat — override only when timezone is specified
  savedIntlDateTimeFormat = Intl.DateTimeFormat;
  const tz = env.timezone;
  const fakeFormat = function () {
    return { resolvedOptions: () => ({ timeZone: tz ?? "" }) };
  };
  // Carry over static props (locales, supportedLocalesOf, etc.)
  Object.assign(fakeFormat, savedIntlDateTimeFormat);
  // @ts-expect-error test-only stub
  Intl.DateTimeFormat = fakeFormat;
  injectedIntl = true;
}

function teardownEnv() {
  if (injectedWindow) {
    // @ts-expect-error test-only cleanup
    delete globalThis.window;
    injectedWindow = false;
  }
  if (injectedNavigator) {
    // @ts-expect-error test-only cleanup
    delete globalThis.navigator;
    injectedNavigator = false;
  }
  if (injectedIntl) {
    Intl.DateTimeFormat = savedIntlDateTimeFormat;
    injectedIntl = false;
  }
  if (injectedLocalStorage) {
    // @ts-expect-error test-only cleanup
    delete globalThis.localStorage;
    injectedLocalStorage = false;
  }
}

// ---------------------------------------------------------------------------
// isRegulatedRegion()
// ---------------------------------------------------------------------------

describe("isRegulatedRegion — regulated regions", () => {
  afterEach(teardownEnv);

  it("returns true for a French locale (EU, GDPR)", () => {
    setupEnv({ language: "fr-FR", timezone: "America/New_York" });
    expect(isRegulatedRegion()).toBe(true);
  });

  it("returns true for a German locale (EU, GDPR)", () => {
    setupEnv({ language: "de-DE", timezone: "America/New_York" });
    expect(isRegulatedRegion()).toBe(true);
  });

  it("returns true for a UK locale (UK GDPR)", () => {
    setupEnv({ language: "en-GB", timezone: "America/New_York" });
    expect(isRegulatedRegion()).toBe(true);
  });

  it("returns true for a Canadian locale (PIPEDA)", () => {
    setupEnv({ language: "en-CA", timezone: "America/New_York" });
    expect(isRegulatedRegion()).toBe(true);
  });

  it("returns true for a French-Canadian locale", () => {
    setupEnv({ language: "fr-CA", timezone: "America/New_York" });
    expect(isRegulatedRegion()).toBe(true);
  });

  it("returns true when locale has no region but timezone is Europe/*", () => {
    setupEnv({ language: "en", timezone: "Europe/Paris" });
    expect(isRegulatedRegion()).toBe(true);
  });

  it("returns true when locale has no region but timezone is Europe/Berlin", () => {
    setupEnv({ language: "en", timezone: "Europe/Berlin" });
    expect(isRegulatedRegion()).toBe(true);
  });

  it("returns true when locale has no region but timezone is Europe/London", () => {
    setupEnv({ language: "en", timezone: "Europe/London" });
    expect(isRegulatedRegion()).toBe(true);
  });

  it("returns true when timezone is Atlantic/Reykjavik (EEA/Iceland)", () => {
    setupEnv({ language: "en", timezone: "Atlantic/Reykjavik" });
    expect(isRegulatedRegion()).toBe(true);
  });

  it("returns true when timezone is a Canadian IANA zone (America/Toronto)", () => {
    setupEnv({ language: "en", timezone: "America/Toronto" });
    expect(isRegulatedRegion()).toBe(true);
  });

  it("returns true when timezone is America/Vancouver (Canada)", () => {
    setupEnv({ language: "en", timezone: "America/Vancouver" });
    expect(isRegulatedRegion()).toBe(true);
  });

  it("returns true when timezone is America/Winnipeg (Canada)", () => {
    setupEnv({ language: "en", timezone: "America/Winnipeg" });
    expect(isRegulatedRegion()).toBe(true);
  });
});

describe("isRegulatedRegion — non-regulated regions", () => {
  afterEach(teardownEnv);

  it("returns false for a US locale with a US timezone", () => {
    setupEnv({ language: "en-US", timezone: "America/New_York" });
    expect(isRegulatedRegion()).toBe(false);
  });

  it("returns false for an Australian locale", () => {
    setupEnv({ language: "en-AU", timezone: "Australia/Sydney" });
    expect(isRegulatedRegion()).toBe(false);
  });

  it("returns false for a Japanese locale", () => {
    setupEnv({ language: "ja-JP", timezone: "Asia/Tokyo" });
    expect(isRegulatedRegion()).toBe(false);
  });

  it("returns false for a Brazilian locale", () => {
    setupEnv({ language: "pt-BR", timezone: "America/Sao_Paulo" });
    expect(isRegulatedRegion()).toBe(false);
  });

  it("returns false for a bare 'en' locale with a US timezone", () => {
    setupEnv({ language: "en", timezone: "America/Chicago" });
    expect(isRegulatedRegion()).toBe(false);
  });

  it("returns false in an SSR context (no window)", () => {
    // Do NOT call setupEnv — window must be absent.
    expect(isRegulatedRegion()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasAnalyticsConsent()
// ---------------------------------------------------------------------------

describe("hasAnalyticsConsent — undecided visitor in a regulated region", () => {
  afterEach(teardownEnv);

  it("blocks analytics (opt-in required) — EU locale, no stored answer", () => {
    setupEnv({ language: "fr-FR", timezone: "Europe/Paris", storedConsent: null });
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("blocks analytics — UK locale, no stored answer", () => {
    setupEnv({ language: "en-GB", timezone: "Europe/London", storedConsent: null });
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("blocks analytics — Canadian timezone, no stored answer", () => {
    setupEnv({ language: "en", timezone: "America/Toronto", storedConsent: null });
    expect(hasAnalyticsConsent()).toBe(false);
  });
});

describe("hasAnalyticsConsent — undecided visitor outside a regulated region", () => {
  afterEach(teardownEnv);

  it("allows analytics (implied consent, opt-out model) — US locale", () => {
    setupEnv({ language: "en-US", timezone: "America/New_York", storedConsent: null });
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("allows analytics — Australian locale", () => {
    setupEnv({ language: "en-AU", timezone: "Australia/Sydney", storedConsent: null });
    expect(hasAnalyticsConsent()).toBe(true);
  });
});

describe("hasAnalyticsConsent — stored decision present", () => {
  afterEach(teardownEnv);

  function validConsentRecord(status: "accepted" | "declined") {
    return JSON.stringify({ status, version: "2026-07-05", ts: Date.now() });
  }

  it("allows analytics after the visitor accepted, regardless of region (EU)", () => {
    setupEnv({
      language: "fr-FR",
      timezone: "Europe/Paris",
      storedConsent: validConsentRecord("accepted"),
    });
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("allows analytics after the visitor accepted — US locale", () => {
    setupEnv({
      language: "en-US",
      timezone: "America/New_York",
      storedConsent: validConsentRecord("accepted"),
    });
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("blocks analytics after the visitor declined, regardless of region (EU)", () => {
    setupEnv({
      language: "fr-FR",
      timezone: "Europe/Paris",
      storedConsent: validConsentRecord("declined"),
    });
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("blocks analytics after the visitor declined — US locale (opt-out respected)", () => {
    setupEnv({
      language: "en-US",
      timezone: "America/New_York",
      storedConsent: validConsentRecord("declined"),
    });
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("ignores a stored consent with a stale version (treats as undecided)", () => {
    const stale = JSON.stringify({ status: "accepted", version: "2020-01-01", ts: 0 });
    // EU locale + stale/ignored acceptance → still blocked
    setupEnv({ language: "de-DE", timezone: "Europe/Berlin", storedConsent: stale });
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("ignores a stored consent with an invalid status string (treats as undecided)", () => {
    const bad = JSON.stringify({ status: "maybe", version: "2026-07-05", ts: 0 });
    setupEnv({ language: "de-DE", timezone: "Europe/Berlin", storedConsent: bad });
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("ignores malformed JSON in storage (treats as undecided)", () => {
    setupEnv({ language: "de-DE", timezone: "Europe/Berlin", storedConsent: "not-json" });
    expect(hasAnalyticsConsent()).toBe(false);
  });
});

describe("hasAnalyticsConsent — SSR context", () => {
  it("always blocks when window is absent", () => {
    // No setupEnv call — window is absent, should not reach consent decision logic.
    expect(hasAnalyticsConsent()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setConsentStatus / getConsentStatus / clearConsentStatus round-trip
// ---------------------------------------------------------------------------

describe("consent status persistence round-trip", () => {
  beforeEach(() => setupEnv({ language: "en-US", timezone: "America/New_York" }));
  afterEach(teardownEnv);

  it("reads back 'accepted' immediately after setting it", () => {
    setConsentStatus("accepted");
    expect(getConsentStatus()).toBe("accepted");
  });

  it("reads back 'declined' immediately after setting it", () => {
    setConsentStatus("declined");
    expect(getConsentStatus()).toBe("declined");
  });

  it("returns null after clearConsentStatus()", () => {
    setConsentStatus("accepted");
    clearConsentStatus();
    expect(getConsentStatus()).toBe(null);
  });
});
