import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// track() consent gate regression tests
//
// The critical invariant: track() must NEVER call getSessionId() or insert
// into the events table when hasAnalyticsConsent() returns false. A future
// refactor of tracking.ts or consent.ts could silently reintroduce an early
// analytics call; these tests will catch it.
//
// We control hasAnalyticsConsent() through real consent.ts logic (no stub),
// driven by the same localStorage + navigator globals the browser uses. This
// means the gate is tested end-to-end through both modules.
//
// Static imports are hoisted above mock.module() by Bun, so ALL module stubs
// must be declared before the dynamic `await import` that brings in tracking.ts.
// ---------------------------------------------------------------------------

// --- Supabase client stub ---------------------------------------------------
// Track every `.from(table).insert(row)` call so tests can assert on them.
const insertCalls: Array<{ table: string; row: unknown }> = [];
const authSessionResult = { data: { session: null }, error: null };

mock.module("@/integrations/supabase/client", () => {
  function buildTable(tableName: string) {
    const q = {
      insert: (row: unknown) => {
        insertCalls.push({ table: tableName, row });
        return Promise.resolve({ data: null, error: null });
      },
      // add other chainable methods as no-ops so callers don't throw
      select: () => q,
      eq: () => q,
    };
    return q;
  }
  const auth = {
    getSession: () => Promise.resolve(authSessionResult),
  };
  return {
    supabase: {
      from: (table: string) => buildTable(table),
      auth,
    },
  };
});

// --- Backend config stub ---------------------------------------------------
// hasBackendEnv() must return true so the track() function doesn't short-circuit
// before it ever reaches the consent check.
mock.module("@/integrations/backend-config", () => ({
  hasBackendEnv: () => true,
}));

// Now import tracking AFTER the stubs are wired up.
// (Static imports would be hoisted above mock.module and bind the real modules.)
const { track } = await import("./tracking");

// ---------------------------------------------------------------------------
// Browser environment helpers (same pattern as consent.test.ts)
// ---------------------------------------------------------------------------

const CONSENT_KEY = "aurora.cookie_consent.v1";
const CONSENT_VERSION = "2026-07-05";

let savedIntlDateTimeFormat: typeof Intl.DateTimeFormat;
let injectedWindow = false;
let injectedNavigator = false;
let injectedLocalStorage = false;
let injectedIntl = false;

function makeLocalStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (k: string): string | null => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    /** Simulate a full storage wipe (private-browsing clear-data, competing script, etc.) */
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

function validConsentRecord(status: "accepted" | "declined") {
  return JSON.stringify({ status, version: CONSENT_VERSION, ts: Date.now() });
}

type TrackingEnv = {
  /** BCP 47 locale, e.g. "fr-FR" (EU/regulated) or "en-US" (non-regulated) */
  language: string;
  timezone: string;
  storedConsent?: string | null;
};

function setupEnv(env: TrackingEnv) {
  // window
  if (typeof globalThis.window === "undefined") {
    // @ts-expect-error test-only stub
    globalThis.window = globalThis;
    injectedWindow = true;
  }
  // @ts-expect-error test-only stub
  globalThis.window.location = { pathname: "/test", href: "https://test/" };
  // @ts-expect-error test-only stub
  globalThis.window.dispatchEvent = () => {};
  // @ts-expect-error test-only stub
  globalThis.dispatchEvent = () => {};

  // navigator
  // @ts-expect-error test-only stub
  globalThis.navigator = { language: env.language, languages: [env.language] };
  injectedNavigator = true;

  // Intl.DateTimeFormat — override for timezone
  savedIntlDateTimeFormat = Intl.DateTimeFormat;
  const tz = env.timezone;
  const fake = function () {
    return { resolvedOptions: () => ({ timeZone: tz }) };
  };
  Object.assign(fake, savedIntlDateTimeFormat);
  // @ts-expect-error test-only stub
  Intl.DateTimeFormat = fake;
  injectedIntl = true;

  // localStorage — may carry a stored consent record
  const initial: Record<string, string> = {};
  if (env.storedConsent != null) {
    initial[CONSENT_KEY] = env.storedConsent;
  }
  // @ts-expect-error test-only stub
  globalThis.localStorage = makeLocalStorage(initial);
  // @ts-expect-error test-only stub
  globalThis.window.localStorage = globalThis.localStorage;
  injectedLocalStorage = true;
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
// Tests — track() must NOT fire when consent is absent
// ---------------------------------------------------------------------------

describe("track() — consent gate blocks analytics", () => {
  beforeEach(() => {
    insertCalls.length = 0; // reset spy between tests
  });
  afterEach(teardownEnv);

  it("does not insert into events when visitor is in EU with no consent stored", async () => {
    setupEnv({ language: "fr-FR", timezone: "Europe/Paris", storedConsent: null });
    await track("page_view");
    expect(insertCalls).toHaveLength(0);
  });

  it("does not insert into events when visitor is in UK with no consent stored", async () => {
    setupEnv({ language: "en-GB", timezone: "Europe/London", storedConsent: null });
    await track("button_click", { label: "signup" });
    expect(insertCalls).toHaveLength(0);
  });

  it("does not insert into events when visitor is in Canada (locale) with no consent stored", async () => {
    setupEnv({ language: "en-CA", timezone: "America/Toronto", storedConsent: null });
    await track("feature_used");
    expect(insertCalls).toHaveLength(0);
  });

  it("does not insert into events when visitor is in Canada (timezone only) with no consent stored", async () => {
    setupEnv({ language: "en", timezone: "America/Vancouver", storedConsent: null });
    await track("page_view");
    expect(insertCalls).toHaveLength(0);
  });

  it("does not insert into events when consent was explicitly declined — EU", async () => {
    setupEnv({
      language: "fr-FR",
      timezone: "Europe/Paris",
      storedConsent: validConsentRecord("declined"),
    });
    await track("page_view");
    expect(insertCalls).toHaveLength(0);
  });

  it("does not insert into events when consent was explicitly declined — US (opt-out respected)", async () => {
    setupEnv({
      language: "en-US",
      timezone: "America/New_York",
      storedConsent: validConsentRecord("declined"),
    });
    await track("page_view");
    expect(insertCalls).toHaveLength(0);
  });

  it("does not generate or store a session ID when blocked by consent", async () => {
    setupEnv({ language: "de-DE", timezone: "Europe/Berlin", storedConsent: null });
    // Spy on what keys are written to localStorage during the blocked track() call.
    const store = globalThis.localStorage as ReturnType<typeof makeLocalStorage>;
    const setItemCalls: string[] = [];
    const origSetItem = store.setItem.bind(store);
    store.setItem = (k: string, v: string) => {
      setItemCalls.push(k);
      origSetItem(k, v);
    };
    await track("test_event");
    // Neither the session key nor any analytics key should have been written.
    expect(setItemCalls.filter((k) => k.includes("session"))).toHaveLength(0);
    expect(insertCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests — track() DOES fire when consent is granted
// ---------------------------------------------------------------------------

describe("track() — analytics fires when consent is present", () => {
  beforeEach(() => {
    insertCalls.length = 0;
  });
  afterEach(teardownEnv);

  it("inserts into the events table when EU visitor has accepted consent", async () => {
    setupEnv({
      language: "fr-FR",
      timezone: "Europe/Paris",
      storedConsent: validConsentRecord("accepted"),
    });
    await track("page_view", { url: "https://example.com" });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]?.table).toBe("events");
    expect((insertCalls[0]?.row as Record<string, unknown>).name).toBe("page_view");
  });

  it("inserts into the events table for a US visitor with no explicit consent (implied)", async () => {
    setupEnv({ language: "en-US", timezone: "America/New_York", storedConsent: null });
    await track("button_click");
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]?.table).toBe("events");
  });

  it("includes the event name and path in the insert payload", async () => {
    setupEnv({
      language: "en-US",
      timezone: "America/New_York",
      storedConsent: null,
    });
    await track("test_event", { foo: "bar" });
    const row = insertCalls[0]?.row as Record<string, unknown>;
    expect(row.name).toBe("test_event");
    expect(row.path).toBeDefined();
  });

  it("does NOT insert when window is absent (SSR guard)", async () => {
    // No setupEnv — window is undefined, track() should return immediately.
    await track("ssr_event");
    expect(insertCalls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Mid-session localStorage eviction — the primary regression this task covers.
//
// hasAnalyticsConsent() reads from localStorage on EVERY call (no in-memory
// cache). If storage is wiped mid-session — private-browsing "clear data",
// a competing script calling localStorage.clear(), or the browser evicting
// storage under quota pressure — a regulated-region visitor's previously
// granted consent record disappears. The next track() call must re-evaluate
// consent, find nothing in storage, and block analytics (opt-in required).
//
// Non-regulated visitors are unaffected because the implied-consent path
// returns true regardless of what's stored.
// ---------------------------------------------------------------------------

describe("track() — mid-session localStorage eviction", () => {
  beforeEach(() => {
    insertCalls.length = 0;
  });
  afterEach(teardownEnv);

  it("blocks analytics for an EU visitor after localStorage is cleared mid-session", async () => {
    // 1. EU locale: opt-in consent is required.
    setupEnv({
      language: "fr-FR",
      timezone: "Europe/Paris",
      storedConsent: validConsentRecord("accepted"),
    });

    // 2. Consent is present → track() should fire normally.
    await track("initial_event");
    expect(insertCalls).toHaveLength(1);
    insertCalls.length = 0; // reset spy

    // 3. Simulate a mid-session full storage wipe (e.g. private-browsing
    //    "clear data" or a competing script calling localStorage.clear()).
    (globalThis.localStorage as ReturnType<typeof makeLocalStorage>).clear();

    // 4. After eviction the consent record is gone. For an EU visitor this
    //    means the opt-in gate is back to "not answered" → analytics must be
    //    blocked immediately, without a page reload.
    await track("post_eviction_event");
    expect(insertCalls).toHaveLength(0);
  });

  it("blocks analytics for a UK visitor after localStorage is cleared mid-session", async () => {
    setupEnv({
      language: "en-GB",
      timezone: "Europe/London",
      storedConsent: validConsentRecord("accepted"),
    });

    await track("initial_event");
    expect(insertCalls).toHaveLength(1);
    insertCalls.length = 0;

    (globalThis.localStorage as ReturnType<typeof makeLocalStorage>).clear();

    await track("post_eviction_event");
    expect(insertCalls).toHaveLength(0);
  });

  it("blocks analytics for a Canadian visitor after localStorage is cleared mid-session", async () => {
    setupEnv({
      language: "en-CA",
      timezone: "America/Toronto",
      storedConsent: validConsentRecord("accepted"),
    });

    await track("initial_event");
    expect(insertCalls).toHaveLength(1);
    insertCalls.length = 0;

    (globalThis.localStorage as ReturnType<typeof makeLocalStorage>).clear();

    await track("post_eviction_event");
    expect(insertCalls).toHaveLength(0);
  });

  it("continues to allow analytics for a US visitor after localStorage is cleared (implied consent, opt-out model)", async () => {
    // Non-regulated region: evicting storage does not require the visitor to
    // re-opt-in; the implied-consent path stays open.
    setupEnv({
      language: "en-US",
      timezone: "America/New_York",
      storedConsent: validConsentRecord("accepted"),
    });

    await track("initial_event");
    expect(insertCalls).toHaveLength(1);
    insertCalls.length = 0;

    (globalThis.localStorage as ReturnType<typeof makeLocalStorage>).clear();

    // hasAnalyticsConsent() → status=null, isRegulatedRegion()=false → returns true.
    await track("post_eviction_event");
    expect(insertCalls).toHaveLength(1);
  });

  it("does not write a session ID to the (now-empty) store for an EU visitor post-eviction", async () => {
    setupEnv({
      language: "de-DE",
      timezone: "Europe/Berlin",
      storedConsent: validConsentRecord("accepted"),
    });

    await track("initial_event");
    insertCalls.length = 0;

    const ls = globalThis.localStorage as ReturnType<typeof makeLocalStorage>;
    ls.clear();

    // Spy on writes after the eviction.
    const writtenKeys: string[] = [];
    const origSetItem = ls.setItem.bind(ls);
    ls.setItem = (k: string, v: string) => {
      writtenKeys.push(k);
      origSetItem(k, v);
    };

    await track("post_eviction_event");

    // No insert and no session-id write should have occurred.
    expect(insertCalls).toHaveLength(0);
    expect(writtenKeys.some((k) => k.includes("session"))).toBe(false);
  });
});
