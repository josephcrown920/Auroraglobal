import { describe, expect, it, mock } from "bun:test";

// Other suites in the full `bun test src/` run register process-global
// mock.module stubs for "@/integrations/supabase/client.server" (Bun's
// mock.module leaks across files — see orchestrator.* and paystack tests).
// Whichever stub registered last would otherwise be live when THIS file's
// tests execute, and most of them don't implement the
// `.from("avatars").select().eq().eq().maybeSingle()` chain that
// assertOwnedReferenceImage needs — failing these tests with
// "select is not a function" in full-suite runs only. Register our own
// functional stub (no rows → every DB-backed ownership lookup misses, which
// is exactly what the rejection tests below assert) so this file is
// order-independent.
function makeEmptyQuery() {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  return q;
}

mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => makeEmptyQuery() },
}));

const { assertOwnStudioUpload, assertOwnedReferenceImage } = await import("./url-guard");

describe("assertOwnStudioUpload (photo editor input guard)", () => {
  const uid = "11111111-2222-3333-4444-555555555555";
  const base = "https://proj.supabase.co/storage/v1/object";

  it("accepts the caller's own signed and public studio uploads", () => {
    expect(() =>
      assertOwnStudioUpload(`${base}/sign/studio/${uid}/uploads/a.jpg?token=x`, uid),
    ).not.toThrow();
    expect(() =>
      assertOwnStudioUpload(`${base}/public/studio/${uid}/uploads/a.jpg`, uid),
    ).not.toThrow();
  });

  it("rejects another user's studio object", () => {
    expect(() =>
      assertOwnStudioUpload(`${base}/sign/studio/other-user/uploads/a.jpg?token=x`, uid),
    ).toThrow("Not your photo");
  });

  it("rejects trusted-host URLs that are not studio objects", () => {
    expect(() =>
      assertOwnStudioUpload(`https://proj.supabase.co/rest/v1/whatever`, uid),
    ).toThrow();
  });

  it("rejects traversal and re-encoding tricks in the object path", () => {
    // Raw `..` is collapsed by the URL parser itself, landing outside the
    // caller's folder — rejected by the ownership check.
    expect(() =>
      assertOwnStudioUpload(`${base}/sign/studio/${uid}/../other/a.jpg`, uid),
    ).toThrow();
    expect(() =>
      assertOwnStudioUpload(`${base}/sign/studio/${uid}%2f..%2fother/a.jpg`, uid),
    ).toThrow();
    // `%2e%2e` segments are dot-normalized by the URL parser too — either way
    // the request must be rejected (ownership or the explicit encoding check).
    expect(() =>
      assertOwnStudioUpload(`${base}/sign/studio/${uid}/%2e%2e/other/a.jpg`, uid),
    ).toThrow();
  });

  it("rejects untrusted hosts before any path check (SSRF guard first)", () => {
    expect(() =>
      assertOwnStudioUpload(`https://evil.test/storage/v1/object/sign/studio/${uid}/a.jpg`, uid),
    ).toThrow();
  });
});

// ─── assertOwnedReferenceImage — Task #408 coverage ───────────────────────────
// This guard is now wired into all four paths that accept user-supplied
// reference images:
//   UGC path        → generateSceneImagesFromRef (referenceUrl field)
//   Performance Shot→ generatePerformanceShot (each imageUrl)
//   Video Agent     → runAuroraAgent + refineAuroraPlan (referenceImages)
//   MCP tools       → imageToVideoTool / animateFromDrivingVideoTool /
//                     performanceReskinTool / submitJobTool (assertOwnedRef dep)

const DB_HOST = "https://tpzmvbczwahxajujvnrq.supabase.co";
const STUDIO_PATH = "/storage/v1/object/public/studio/";
const OWN_USER = "00000000-0000-0000-0000-000000000001";
const OTHER_USER = "00000000-0000-0000-0000-000000000002";

describe("assertOwnedReferenceImage — own studio URL resolves immediately (no DB)", () => {
  it("resolves for a studio URL whose first segment matches the caller's userId", async () => {
    const ownUrl = `${DB_HOST}${STUDIO_PATH}${OWN_USER}/portrait.jpg`;
    await expect(assertOwnedReferenceImage(ownUrl, OWN_USER)).resolves.toBeUndefined();
  });
});

describe("assertOwnedReferenceImage — foreign URLs are rejected (covers UGC, PerformanceShot, Agent paths)", () => {
  it("rejects a foreign user's studio URL with a clear ownership error", async () => {
    const foreignUrl = `${DB_HOST}${STUDIO_PATH}${OTHER_USER}/portrait.jpg`;
    await expect(assertOwnedReferenceImage(foreignUrl, OWN_USER)).rejects.toThrow(
      "You can only use character images you own.",
    );
  });

  it("rejects an untrusted host even if the path resembles a studio URL", async () => {
    const evil = `https://evil.example.com${STUDIO_PATH}${OWN_USER}/photo.jpg`;
    await expect(assertOwnedReferenceImage(evil, OWN_USER)).rejects.toThrow(/host not allowed/);
  });

  it("rejects an external CDN URL not linked to any owned avatar or generation", async () => {
    // replicate.delivery is a trusted host (SSRF-safe) but not in the user's
    // studio bucket or their generation results → must throw.
    const external = "https://replicate.delivery/pbxt/totally-not-owned/output.jpg";
    await expect(assertOwnedReferenceImage(external, OWN_USER)).rejects.toThrow(
      "You can only use character images you own.",
    );
  });
});
