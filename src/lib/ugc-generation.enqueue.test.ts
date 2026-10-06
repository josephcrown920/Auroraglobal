import { describe, expect, test } from "bun:test";
import { _enqueueUGCAd } from "./ugc-generation.functions";

// Guard rejections must fire BEFORE create_generation_and_reserve moves any
// credits — every case here fails on a pure URL-pattern check (or, for the
// foreign-avatar case, read-only ownership lookups that find nothing), so a
// rejection with the guard's own message proves the reserve RPC was never
// reached (it would otherwise surface a PostgREST error instead).
const SELF = "00000000-0000-0000-0000-000000000000";
const OTHER = "11111111-1111-1111-1111-111111111111";
const SUPA = "https://tpzmvbczwahxajujvnrq.supabase.co";

const base = {
  avatarImageUrl: `${SUPA}/storage/v1/object/public/studio/${SELF}/ugc/avatar-maya.jpg`,
  productPrompt: "holding a glossy red lipstick",
  aspect: "9:16" as const,
  duration: 8,
};

describe("_enqueueUGCAd pre-reserve guards", () => {
  test("rejects a character image in another user's studio folder", async () => {
    await expect(
      _enqueueUGCAd(SELF, {
        ...base,
        avatarImageUrl: `${SUPA}/storage/v1/object/public/studio/${OTHER}/ugc/avatar-maya.jpg`,
      }),
    ).rejects.toThrow(/only use character images you own/i);
  });

  test("rejects an untrusted audioUrl host (SSRF) before reserving credits", async () => {
    await expect(
      _enqueueUGCAd(SELF, { ...base, audioUrl: "http://169.254.169.254/latest/meta-data" }),
    ).rejects.toThrow(/url host not allowed/i);
  });

  test("rejects a voice track in another user's studio folder", async () => {
    await expect(
      _enqueueUGCAd(SELF, {
        ...base,
        audioUrl: `${SUPA}/storage/v1/object/sign/studio/${OTHER}/ugc/voice.wav?token=abc`,
      }),
    ).rejects.toThrow(/not your photo/i);
  });

  test("rejects encoded-slash tricks in the voice-track path", async () => {
    // %2f survives WHATWG path normalization (unlike %2e%2e, which the URL
    // parser resolves before the guard runs), so the guard rejects it outright.
    await expect(
      _enqueueUGCAd(SELF, {
        ...base,
        audioUrl: `${SUPA}/storage/v1/object/public/studio/${SELF}/ugc%2f..%2fsecret.wav`,
      }),
    ).rejects.toThrow(/invalid photo url/i);
  });
});
