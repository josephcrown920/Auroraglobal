// Preview-confirm gate (task #153) — pure validation tests.
// validateConfirmedPreview is the single decision point for whether a
// confirmPreviewId unlocks a full-quality temporal render; every rejection
// must throw a TERMINAL "Unsupported…" error (never silently pass).
import { describe, expect, test } from "bun:test";
import {
  validateConfirmedPreview,
  isTemporalKind,
  PREVIEW_CONFIRM_WINDOW_MS,
  type PreviewRowCheck,
} from "./cost-guardrails.server";

const NOW = Date.parse("2026-07-02T12:00:00Z");

function row(over: Partial<PreviewRowCheck> = {}): PreviewRowCheck {
  return {
    id: "p1",
    user_id: "u1",
    kind: "video",
    mode: "preview",
    status: "succeeded",
    created_at: new Date(NOW - 60_000).toISOString(),
    ...over,
  };
}

describe("isTemporalKind", () => {
  test("all motion-producing kinds are gated; static kinds are not", () => {
    expect(isTemporalKind("video")).toBe(true);
    expect(isTemporalKind("lipsync")).toBe(true);
    expect(isTemporalKind("motion")).toBe(true);
    expect(isTemporalKind("performance_reskin")).toBe(true);
    expect(isTemporalKind("image")).toBe(false);
    expect(isTemporalKind("audio")).toBe(false);
    expect(isTemporalKind("text")).toBe(false);
  });
});

describe("validateConfirmedPreview", () => {
  test("accepts a fresh succeeded preview owned by the user", () => {
    expect(() => validateConfirmedPreview(row(), "u1", NOW)).not.toThrow();
    expect(() =>
      validateConfirmedPreview(row({ kind: "lipsync", status: "complete" }), "u1", NOW),
    ).not.toThrow();
    // Motion-producing queue kinds are valid preview tickets too.
    expect(() => validateConfirmedPreview(row({ kind: "motion" }), "u1", NOW)).not.toThrow();
    expect(() =>
      validateConfirmedPreview(row({ kind: "performance_reskin", status: "complete" }), "u1", NOW),
    ).not.toThrow();
  });

  test("rejects a missing row and another user's preview identically", () => {
    expect(() => validateConfirmedPreview(null, "u1", NOW)).toThrow(/^Unsupported .*not found/);
    // Ownership failure must be indistinguishable from not-found (no oracle).
    expect(() => validateConfirmedPreview(row({ user_id: "attacker" }), "u1", NOW)).toThrow(
      /^Unsupported .*not found/,
    );
  });

  test("rejects a non-preview generation (a full render is not a ticket)", () => {
    expect(() => validateConfirmedPreview(row({ mode: "performance" }), "u1", NOW)).toThrow(
      /^Unsupported/,
    );
  });

  test("rejects non-temporal kinds and unfinished previews", () => {
    expect(() => validateConfirmedPreview(row({ kind: "image" }), "u1", NOW)).toThrow(
      /^Unsupported/,
    );
    for (const status of ["processing", "failed", null]) {
      expect(() => validateConfirmedPreview(row({ status }), "u1", NOW)).toThrow(/^Unsupported/);
    }
  });

  test("rejects an expired preview but accepts one just inside the window", () => {
    const stale = new Date(NOW - PREVIEW_CONFIRM_WINDOW_MS - 1000).toISOString();
    const fresh = new Date(NOW - PREVIEW_CONFIRM_WINDOW_MS + 60_000).toISOString();
    expect(() => validateConfirmedPreview(row({ created_at: stale }), "u1", NOW)).toThrow(
      /expired/,
    );
    expect(() => validateConfirmedPreview(row({ created_at: fresh }), "u1", NOW)).not.toThrow();
    expect(() => validateConfirmedPreview(row({ created_at: null }), "u1", NOW)).toThrow(
      /^Unsupported/,
    );
  });
});
