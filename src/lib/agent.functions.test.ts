import { describe, expect, it } from "bun:test";
import { runAuroraAgentCore } from "./agent.functions";

// Pins the reference-image ownership guard on the Aurora Agent planner path:
// every referenceImages URL must belong to the caller and is checked BEFORE
// anything is sent to the LLM provider. The core is deps-injected
// (gifts.functions.ts pattern) so no LLM or DB is touched here.

const OWNERSHIP_ERR = "You can only use character images you own.";
const STUDIO = "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/";

const FAKE_PLAN = {
  title: "Test plan",
  summary: "A minimal plan",
  scenes: [],
};

type AgentDeps = NonNullable<Parameters<typeof runAuroraAgentCore>[2]>;

function makeDeps(over: Partial<AgentDeps> = {}) {
  let generateCalls = 0;
  const deps = {
    assertOwned: async () => {},
    generate: (async () => {
      generateCalls++;
      return { output: FAKE_PLAN };
    }) as unknown as AgentDeps["generate"],
    ...over,
  } as AgentDeps;
  return { deps, generated: () => generateCalls };
}

describe("runAuroraAgentCore — ownership guard", () => {
  it("rejects a foreign reference image BEFORE any LLM call", async () => {
    const { deps, generated } = makeDeps({
      assertOwned: async () => {
        throw new Error(OWNERSHIP_ERR);
      },
    });
    await expect(
      runAuroraAgentCore(
        "user-1",
        { brief: "make a launch teaser", referenceImages: [`${STUDIO}other-user/face.jpg`] },
        deps,
      ),
    ).rejects.toThrow(/character images you own/);
    expect(generated()).toBe(0);
  });

  it("checks every owned reference image, then returns the plan", async () => {
    const seen: string[] = [];
    const { deps, generated } = makeDeps({
      assertOwned: async (url: string) => {
        seen.push(url);
      },
    });
    const urls = [`${STUDIO}me/a.jpg`, `${STUDIO}me/b.jpg`];
    const plan = await runAuroraAgentCore(
      "user-1",
      { brief: "make a launch teaser", referenceImages: urls },
      deps,
    );
    expect(seen).toEqual(urls);
    expect(generated()).toBe(1);
    expect(plan).toEqual(FAKE_PLAN as never);
  });

  it("skips the guard when no reference images are supplied", async () => {
    const seen: string[] = [];
    const { deps } = makeDeps({
      assertOwned: async (url: string) => {
        seen.push(url);
      },
    });
    await runAuroraAgentCore("user-1", { brief: "make a launch teaser" }, deps);
    expect(seen).toHaveLength(0);
  });
});
