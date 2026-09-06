import { describe, expect, it } from "bun:test";
import { sweepStaleTiktokPosts, type TiktokPostSweepDependencies } from "./tiktok-posting.server";

type QueryResponse = { data: Array<Record<string, unknown>> | null; error: { message: string } | null };

function fakeAdmin(responses: QueryResponse[]) {
  const updates: Array<Record<string, unknown>> = [];
  const filters: Array<[string, unknown, unknown?]> = [];
  const from = () => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "is", "not", "lt", "order", "limit"]) {
      chain[method] = (...args: unknown[]) => {
        if (method !== "select" && method !== "order" && method !== "limit") {
          filters.push([method, args[0], args[1]]);
        }
        return chain;
      };
    }
    chain.update = (patch: Record<string, unknown>) => {
      updates.push(patch);
      return chain;
    };
    chain.then = (resolve: (value: QueryResponse) => unknown) =>
      Promise.resolve(responses.shift() ?? { data: null, error: null }).then(resolve);
    return chain;
  };
  return { admin: { from } as unknown as TiktokPostSweepDependencies["admin"], updates, filters };
}

describe("sweepStaleTiktokPosts", () => {
  it("recovers no-ID rows, skips lost claims, and isolates provider failures", async () => {
    const db = fakeAdmin([
      { data: [{ id: "orphan" }], error: null },
      { data: [], error: null },
      { data: [{ id: "ok" }, { id: "raced" }, { id: "provider-error" }], error: null },
      { data: [{ id: "ok", user_id: "u1", publish_id: "p1" }], error: null },
      { data: [], error: null },
      { data: [{ id: "provider-error", user_id: "u2", publish_id: "p2" }], error: null },
      { data: null, error: null },
    ]);
    const checked: string[] = [];
    const result = await sweepStaleTiktokPosts(new Date("2026-09-06T12:00:00Z"), {
      admin: db.admin,
      getAccessToken: async (userId) => `token:${userId}`,
      getPostStatus: async (_token, publishId) => {
        checked.push(publishId);
        if (publishId === "p2") throw new Error("TikTok unavailable");
        return { status: "publish_complete" };
      },
    });

    expect(result).toEqual({ checked: 2, updated: 1, initiationFailed: 1, timedOut: 0, errors: 1 });
    expect(checked.sort()).toEqual(["p1", "p2"]);
    expect(db.updates).toContainEqual(expect.objectContaining({ status: "failed", error_msg: "TikTok post initiation timed out — retry" }));
    expect(db.updates).toContainEqual(expect.objectContaining({ status: "publish_complete", posted_at: "2026-09-06T12:00:00.000Z" }));
  });

  it("only replaces a missing failure reason after 24 hours", async () => {
    const db = fakeAdmin([
      { data: [], error: null },
      { data: [{ id: "timed-out" }], error: null },
      { data: [], error: null },
    ]);
    const result = await sweepStaleTiktokPosts(new Date("2026-09-06T12:00:00Z"), {
      admin: db.admin,
      getAccessToken: async () => "unused",
      getPostStatus: async () => ({ status: "failed" }),
    });

    expect(result.timedOut).toBe(1);
    expect(db.updates).toContainEqual(expect.objectContaining({ error_msg: "Timed out — check TikTok for status" }));
    expect(db.filters).toContainEqual(["is", "error_msg", null]);
  });
});