import { describe, expect, it, beforeEach, mock } from "bun:test";

// assertOwnedReferenceImage guards every user-supplied "character" reference
// image (kids-story characterImageUrl, motion transfer imageUrl, performance
// reskin avatarImageUrl) against pointing at someone else's private asset.
// mock.module must be registered before url-guard is imported.

type Row = { user_id: string; preview_url: string };
let avatarRows: Row[] = [];

function makeAvatarsQuery() {
  const state: { userId?: string; previewUrl?: string } = {};
  const q = {
    select: () => q,
    eq: (col: string, val: string) => {
      if (col === "user_id") state.userId = val;
      if (col === "preview_url") state.previewUrl = val;
      return q;
    },
    maybeSingle: async () => {
      const match = avatarRows.find(
        (r) => r.user_id === state.userId && r.preview_url === state.previewUrl,
      );
      return { data: match ? { id: "avatar-1" } : null, error: null };
    },
  };
  return q;
}

const supabaseAdmin = {
  from: (table: string) => {
    if (table === "avatars") return makeAvatarsQuery();
    throw new Error(`unexpected table: ${table}`);
  },
};

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin }));

const { assertOwnedReferenceImage } = await import("./url-guard");

const UID = "11111111-2222-3333-4444-555555555555";
const OTHER_UID = "other-user";
const BASE = "https://proj.supabase.co/storage/v1/object";

beforeEach(() => {
  avatarRows = [];
});

describe("assertOwnedReferenceImage", () => {
  it("accepts the caller's own studio upload", async () => {
    await expect(
      assertOwnedReferenceImage(`${BASE}/public/studio/${UID}/uploads/a.jpg`, UID),
    ).resolves.toBeUndefined();
  });

  it("accepts a saved avatar the caller owns", async () => {
    avatarRows = [{ user_id: UID, preview_url: "https://proj.supabase.co/some/avatar.png" }];
    await expect(
      assertOwnedReferenceImage("https://proj.supabase.co/some/avatar.png", UID),
    ).resolves.toBeUndefined();
  });

  it("rejects another user's private studio asset", async () => {
    await expect(
      assertOwnedReferenceImage(`${BASE}/public/studio/${OTHER_UID}/uploads/a.jpg`, UID),
    ).rejects.toThrow(/own/i);
  });

  it("rejects a URL that is neither an own upload nor an owned avatar", async () => {
    avatarRows = [{ user_id: OTHER_UID, preview_url: "https://proj.supabase.co/some/avatar.png" }];
    await expect(
      assertOwnedReferenceImage("https://proj.supabase.co/some/avatar.png", UID),
    ).rejects.toThrow(/own/i);
  });

  it("rejects untrusted hosts before any ownership check", async () => {
    await expect(
      assertOwnedReferenceImage("https://evil.test/whatever.png", UID),
    ).rejects.toThrow();
  });
});
