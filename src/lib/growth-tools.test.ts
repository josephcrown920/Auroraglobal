import { describe, expect, it } from "bun:test";
import {
  generateDailyPostsCore,
  generateRolloutPlanCore,
  generateSocialPackCore,
} from "./growth-tools.functions";

// Growth Tools are Pro-gated, credit-charging server functions. The
// createServerFn handlers can't run without a live Start request context, so
// we exercise the deps-injected cores directly with an in-memory admin stub
// (mirrors the issueGiftCardCore pattern in gifts.functions.test.ts).
//
// The critical invariant under test: a Free user must NEVER reach
// `reserve_credits` — the Pro gate must short-circuit before any RPC call.

function fakeAdmin(opts: { plan?: string | null; isAdmin?: boolean; reserveOk?: boolean }) {
  const calls = {
    rpc: [] as Array<{ name: string; args: unknown }>,
  };

  function table(name: string) {
    const b: Record<string, unknown> = {};
    if (name === "profiles") {
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = async () => ({
        data: opts.plan === undefined ? null : { plan: opts.plan },
        error: null,
      });
      return b;
    }
    if (name === "user_roles") {
      b.select = () => b;
      // checkPro awaits the result of `.eq(...)` directly (no `.maybeSingle()`
      // in that branch), so `.eq()` must resolve like a promise.
      b.eq = async () =>
        opts.isAdmin ? { data: [{ role: "admin" }], error: null } : { data: [], error: null };
      return b;
    }
    if (name === "growth_tool_runs") {
      b.insert = async () => ({ error: null });
      return b;
    }
    throw new Error(`fakeAdmin: unexpected table ${name}`);
  }

  const admin = {
    from: (n: string) => table(n),
    rpc: async (name: string, args: unknown) => {
      calls.rpc.push({ name, args });
      if (name === "reserve_credits") {
        return { data: opts.reserveOk ?? true, error: null };
      }
      return { data: null, error: null };
    },
  };
  return { admin, calls };
}

function unusedGenerate() {
  return async () => {
    throw new Error("deps.generate should not be called in this test path");
  };
}

const dailyPostsInput = {
  songTitle: "Neon Nights",
  artistName: "Aria Vex",
  genre: "synthwave",
  releaseStatus: "upcoming" as const,
  platforms: ["Instagram", "TikTok"] as const,
  tone: "hype" as const,
};

const rolloutPlanInput = {
  songTitle: "Neon Nights",
  artistName: "Aria Vex",
  genre: "synthwave",
  releaseDate: "2026-08-01",
  targetPlatforms: ["Instagram", "TikTok"] as const,
  budget: "zero" as const,
};

const socialPackInput = {
  songTitle: "Neon Nights",
  artistName: "Aria Vex",
  genre: "synthwave",
  mood: "euphoric",
  visualStyle: "retro neon",
  keyMessage: "new single out now",
};

describe("generateDailyPostsCore", () => {
  it("blocks Free users with proRequired and never reserves credits", async () => {
    const { admin, calls } = fakeAdmin({ plan: "free", isAdmin: false });
    const result = await generateDailyPostsCore(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { admin, generate: unusedGenerate() } as any,
      "u1",
      dailyPostsInput,
    );
    expect(result).toMatchObject({ ok: false, proRequired: true });
    expect(calls.rpc.find((c) => c.name === "reserve_credits")).toBeUndefined();
  });

  it("returns insufficient for a Pro user without enough Aura", async () => {
    const { admin, calls } = fakeAdmin({ plan: "pro", reserveOk: false });
    const result = await generateDailyPostsCore(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { admin, generate: unusedGenerate() } as any,
      "u1",
      dailyPostsInput,
    );
    expect(result).toMatchObject({ ok: false, insufficient: true });
    expect(calls.rpc.find((c) => c.name === "reserve_credits")).toBeDefined();
  });
});

describe("generateRolloutPlanCore", () => {
  it("blocks Free users with proRequired and never reserves credits", async () => {
    const { admin, calls } = fakeAdmin({ plan: "free", isAdmin: false });
    const result = await generateRolloutPlanCore(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { admin, generate: unusedGenerate() } as any,
      "u1",
      rolloutPlanInput,
    );
    expect(result).toMatchObject({ ok: false, proRequired: true });
    expect(calls.rpc.find((c) => c.name === "reserve_credits")).toBeUndefined();
  });

  it("returns insufficient for a Pro user without enough Aura", async () => {
    const { admin, calls } = fakeAdmin({ plan: "pro", reserveOk: false });
    const result = await generateRolloutPlanCore(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { admin, generate: unusedGenerate() } as any,
      "u1",
      rolloutPlanInput,
    );
    expect(result).toMatchObject({ ok: false, insufficient: true });
    expect(calls.rpc.find((c) => c.name === "reserve_credits")).toBeDefined();
  });
});

describe("generateSocialPackCore", () => {
  it("blocks Free users with proRequired and never reserves credits", async () => {
    const { admin, calls } = fakeAdmin({ plan: "free", isAdmin: false });
    const result = await generateSocialPackCore(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { admin, generate: unusedGenerate() } as any,
      "u1",
      socialPackInput,
    );
    expect(result).toMatchObject({ ok: false, proRequired: true });
    expect(calls.rpc.find((c) => c.name === "reserve_credits")).toBeUndefined();
  });

  it("returns insufficient for a Pro user without enough Aura", async () => {
    const { admin, calls } = fakeAdmin({ plan: "pro", reserveOk: false });
    const result = await generateSocialPackCore(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { admin, generate: unusedGenerate() } as any,
      "u1",
      socialPackInput,
    );
    expect(result).toMatchObject({ ok: false, insufficient: true });
    expect(calls.rpc.find((c) => c.name === "reserve_credits")).toBeDefined();
  });

  it("does not gate a plain admin-role user out even without a pro plan (isAdmin bypasses Pro gate)", async () => {
    const { admin, calls } = fakeAdmin({ plan: "free", isAdmin: true, reserveOk: false });
    const result = await generateSocialPackCore(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { admin, generate: unusedGenerate() } as any,
      "u1",
      socialPackInput,
    );
    // Admins are treated as Pro by checkPro(); they still hit the credit gate.
    expect(result).toMatchObject({ ok: false, insufficient: true });
    expect(calls.rpc.find((c) => c.name === "reserve_credits")).toBeDefined();
  });
});
