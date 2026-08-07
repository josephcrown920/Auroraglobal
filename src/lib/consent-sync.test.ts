import { describe, it, expect } from "bun:test";
import { syncConsentForSession } from "./consent-sync";
import type { ConsentSyncDeps } from "./consent-sync";
import type { ConsentStatus } from "./consent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeps(overrides: Partial<ConsentSyncDeps> = {}): ConsentSyncDeps {
  return {
    getServerConsent: async () => null,
    saveServerConsent: async () => undefined,
    getLocalConsent: () => null,
    setLocalConsent: () => undefined,
    isRegulatedRegion: () => true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Anonymous visitor (no session)
// ---------------------------------------------------------------------------

describe("syncConsentForSession — anonymous", () => {
  it("shows the banner in a regulated region with no local answer", async () => {
    const result = await syncConsentForSession(null, makeDeps());
    expect(result).toEqual({ action: "show" });
  });

  it("hides the banner outside a regulated region with no local answer", async () => {
    const result = await syncConsentForSession(
      null,
      makeDeps({ isRegulatedRegion: () => false }),
    );
    expect(result).toEqual({ action: "hide" });
  });

  it("hides the banner when a local answer already exists (any region)", async () => {
    for (const status of ["accepted", "declined"] as ConsentStatus[]) {
      const result = await syncConsentForSession(
        null,
        makeDeps({ getLocalConsent: () => status }),
      );
      expect(result).toEqual({ action: "hide" });
    }
  });
});

// ---------------------------------------------------------------------------
// Authenticated — fresh device (no local answer)
// ---------------------------------------------------------------------------

describe("syncConsentForSession — signed in, fresh device", () => {
  it("seeds local from server and returns 'seeded' when server has an answer", async () => {
    const seeded: ConsentStatus[] = [];

    const result = await syncConsentForSession(
      "user-123",
      makeDeps({
        getServerConsent: async () => "accepted",
        setLocalConsent: (s) => seeded.push(s),
      }),
    );

    expect(result).toEqual({ action: "seeded", status: "accepted" });
    expect(seeded).toEqual(["accepted"]);
  });

  it("seeds 'declined' from server correctly", async () => {
    const seeded: ConsentStatus[] = [];

    const result = await syncConsentForSession(
      "user-456",
      makeDeps({
        getServerConsent: async () => "declined",
        setLocalConsent: (s) => seeded.push(s),
      }),
    );

    expect(result).toEqual({ action: "seeded", status: "declined" });
    expect(seeded).toEqual(["declined"]);
  });

  it("shows the banner when server and local are both empty (regulated region)", async () => {
    const result = await syncConsentForSession("user-789", makeDeps());
    expect(result).toEqual({ action: "show" });
  });

  it("hides the banner when server and local are both empty (non-regulated region)", async () => {
    const result = await syncConsentForSession(
      "user-789",
      makeDeps({ isRegulatedRegion: () => false }),
    );
    expect(result).toEqual({ action: "hide" });
  });
});

// ---------------------------------------------------------------------------
// Authenticated — sign-in after an anonymous consent decision
// ---------------------------------------------------------------------------

describe("syncConsentForSession — sign-in after anonymous decision", () => {
  it("pushes local answer to server and returns 'pushed' when server has no preference", async () => {
    const saved: ConsentStatus[] = [];

    const result = await syncConsentForSession(
      "user-abc",
      makeDeps({
        getServerConsent: async () => null,
        saveServerConsent: async (s) => { saved.push(s); },
        getLocalConsent: () => "declined",
      }),
    );

    expect(result).toEqual({ action: "pushed", status: "declined" });
    expect(saved).toEqual(["declined"]);
  });

  it("does NOT overwrite an existing server preference with the local value", async () => {
    const saved: ConsentStatus[] = [];
    const seeded: ConsentStatus[] = [];

    // Server says "accepted", local says "declined" (set anonymously earlier).
    const result = await syncConsentForSession(
      "user-abc",
      makeDeps({
        getServerConsent: async () => "accepted",
        saveServerConsent: async (s) => { saved.push(s); },
        getLocalConsent: () => "declined",
        setLocalConsent: (s) => seeded.push(s),
      }),
    );

    // Server wins: local is updated to "accepted", server is NOT overwritten.
    expect(result).toEqual({ action: "seeded", status: "accepted" });
    expect(seeded).toEqual(["accepted"]);
    expect(saved).toEqual([]); // saveServerConsent must NOT have been called
  });
});

// ---------------------------------------------------------------------------
// Server fetch failure — graceful degradation
// ---------------------------------------------------------------------------

describe("syncConsentForSession — server error", () => {
  it("falls back to banner when server throws and local is empty", async () => {
    const result = await syncConsentForSession(
      "user-xyz",
      makeDeps({
        getServerConsent: async () => { throw new Error("network error"); },
      }),
    );
    expect(result).toEqual({ action: "show" });
  });

  it("uses local answer for push-to-server path when server throws", async () => {
    // Server throws → falls back; local has answer → push (but push also
    // won't reach the server — we just verify no unhandled crash occurs).
    const result = await syncConsentForSession(
      "user-xyz",
      makeDeps({
        getServerConsent: async () => { throw new Error("network error"); },
        getLocalConsent: () => "accepted",
      }),
    );
    // After server failure, serverStatus is null → local pushed.
    expect(result).toEqual({ action: "pushed", status: "accepted" });
  });
});
