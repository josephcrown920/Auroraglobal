import { describe, expect, it } from "bun:test";
import { assertOwnStudioUpload } from "./url-guard";

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
