import { describe, it, expect } from "bun:test";
import { refinePlan, type RefineDeps } from "./agent-loop.server";
import type { AgentPlan, Critique } from "./agent.schema";

function makePlan(title: string): AgentPlan {
  return {
    title,
    logline: "a one-line pitch",
    direction: "moody neon noir",
    palette: ["#0a0a0a", "#1b2a4a", "#ff2e63"],
    shots: [
      { id: "S1", title: "Open", shotType: "Wide", camera: "35mm, static", action: "establish", prompt: "p1" },
      { id: "S2", title: "Build", shotType: "Medium", camera: "50mm, push", action: "rise", prompt: "p2" },
      { id: "S3", title: "Peak", shotType: "Close", camera: "85mm, handheld", action: "climax", prompt: "p3" },
    ],
    suggestions: ["generate shot 1", "try a split on shot 3"],
  };
}

function makeCritique(score: number, issueCount: number): Critique {
  return {
    score,
    verdict: "v",
    strengths: ["strong concept"],
    issues: Array.from({ length: issueCount }, (_, i) => ({
      target: `S${i + 1}`,
      problem: "weak prompt",
      fix: "make it more specific",
    })),
  };
}

/** Build deps whose critic returns a scripted score per call. */
function scriptedDeps(scores: number[], issuesPerRound?: number[]) {
  const counts = { propose: 0, critique: 0, refine: 0 };
  let call = 0;
  const deps: RefineDeps = {
    async propose() {
      counts.propose++;
      return makePlan("v0");
    },
    async refine() {
      counts.refine++;
      return makePlan(`v${counts.refine}`);
    },
    async critique() {
      const idx = call++;
      const score = scores[Math.min(idx, scores.length - 1)];
      const issues = issuesPerRound?.[idx] ?? (score >= 85 ? 0 : 2);
      return makeCritique(score, issues);
    },
  };
  return { deps, counts };
}

describe("refinePlan", () => {
  it("stops immediately when the first plan meets the threshold", async () => {
    const { deps, counts } = scriptedDeps([90]);
    const r = await refinePlan({ brief: "b", threshold: 85, maxIterations: 3 }, deps);
    expect(r.iterations.length).toBe(1);
    expect(r.finalScore).toBe(90);
    expect(r.stopReason).toBe("threshold");
    expect(counts.refine).toBe(0);
  });

  it("stops at threshold once a refined plan crosses the bar", async () => {
    const { deps, counts } = scriptedDeps([60, 88]);
    const r = await refinePlan({ brief: "b", threshold: 85, maxIterations: 3 }, deps);
    expect(r.iterations.length).toBe(2);
    expect(r.finalScore).toBe(88);
    expect(r.stopReason).toBe("threshold");
    expect(counts.refine).toBe(1);
  });

  it("runs up to maxIterations when scores keep improving but never reach threshold", async () => {
    const { deps, counts } = scriptedDeps([50, 60, 70]);
    const r = await refinePlan({ brief: "b", threshold: 85, maxIterations: 3 }, deps);
    expect(r.iterations.length).toBe(3);
    expect(r.finalScore).toBe(70);
    expect(r.stopReason).toBe("max_iterations");
    expect(counts.refine).toBe(2);
  });

  it("stops early when improvement stalls (diminishing returns)", async () => {
    const { deps } = scriptedDeps([50, 52]);
    const r = await refinePlan({ brief: "b", threshold: 85, maxIterations: 5 }, deps);
    expect(r.iterations.length).toBe(2);
    expect(r.stopReason).toBe("converged");
  });

  it("stops when the critic returns zero issues even below the numeric threshold", async () => {
    const { deps } = scriptedDeps([70], [0]);
    const r = await refinePlan({ brief: "b", threshold: 85, maxIterations: 3 }, deps);
    expect(r.iterations.length).toBe(1);
    expect(r.stopReason).toBe("threshold");
  });

  it("records every iteration's plan and critique in order", async () => {
    const { deps } = scriptedDeps([40, 60, 75]);
    const r = await refinePlan({ brief: "b", threshold: 85, maxIterations: 3 }, deps);
    expect(r.iterations.map((i) => i.n)).toEqual([1, 2, 3]);
    expect(r.iterations.map((i) => i.critique.score)).toEqual([40, 60, 75]);
    expect(r.iterations[r.iterations.length - 1].plan).toBe(r.plan);
  });
});
