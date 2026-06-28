import { describe, expect, it } from "bun:test";
import { buildBulkImagePayload, requireAvatarReference } from "./tools.server";

// These guard the "one avatar, many shots" identity contract for the MCP path.
// The regression we are protecting against: a bulk/video generation that drops the
// avatar's reference image and renders from the trigger word alone → every shot is
// a different random face. requireAvatarReference + buildBulkImagePayload are the
// single source of truth for that contract, so testing them pins the behavior.

const TRUSTED_REF =
  "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/josh-front.jpeg";

describe("requireAvatarReference", () => {
  it("returns the avatar's reference image when it is present and trusted", () => {
    expect(requireAvatarReference({ name: "Josh", preview_url: TRUSTED_REF })).toBe(TRUSTED_REF);
  });

  it("throws a clear, caller-facing error when the avatar has no reference image", () => {
    for (const preview_url of [null, undefined, ""]) {
      expect(() => requireAvatarReference({ name: "Josh", preview_url })).toThrow(
        /Josh.*no reference image.*image_urls/,
      );
    }
  });

  it("rejects an untrusted reference host (SSRF guard), never letting it through", () => {
    expect(() =>
      requireAvatarReference({ name: "Josh", preview_url: "https://evil.example.com/josh.png" }),
    ).toThrow(/host not allowed/);
  });
});

describe("buildBulkImagePayload", () => {
  it("locks identity: payload carries the reference image and the image-input model", () => {
    const payload = buildBulkImagePayload("josh sipping coffee, golden hour", TRUSTED_REF);
    expect(payload).toEqual({
      kind: "image",
      model: "google/nano-banana",
      prompt: "josh sipping coffee, golden hour",
      imageUrls: [TRUSTED_REF],
    });
  });

  it("never produces a text-only payload (imageUrls must be non-empty)", () => {
    const payload = buildBulkImagePayload("any prompt", TRUSTED_REF);
    expect(payload.imageUrls).toHaveLength(1);
    expect(payload.imageUrls[0]).toBe(TRUSTED_REF);
  });
});
