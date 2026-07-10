// Task #275 — Aurora Template batch fan-out credit flow.
// Proves each batch item runs its OWN reserve → orchestrate → commit cycle
// (distinct reservation refs, no shared/skipped reservations), and that one
// failing item releases only its own credits while the others still commit.
import { describe, expect, it } from "bun:test";
import type { RenderDeps } from "./generate-core.server";
import {
  renderAuroraTemplateCharacters,
  type AuroraTemplateRow,
} from "./aurora-templates.functions";
import type {
  HeyGenTemplateCharacterVariable,
  HeyGenTemplateVariable,
  HeyGenTemplateVariables,
} from "./heygen.server";

const fixedVars: HeyGenTemplateVariables = {
  headline: { name: "headline", type: "text", properties: { content: "Same story" } },
  presenter: {
    name: "presenter",
    type: "character",
    properties: { type: "avatar", character_id: "avatar_default" },
  },
};

const tpl: AuroraTemplateRow = {
  id: "tpl_row_1",
  user_id: "user_1",
  name: "Summer promo",
  heygen_template_id: "hg_tpl_9",
  fixed_variables: fixedVars,
  character_variable_key: "presenter",
  created_at: "2026-07-10T00:00:00Z",
  updated_at: "2026-07-10T00:00:00Z",
};

const characters: HeyGenTemplateCharacterVariable[] = ["av_a", "av_b", "av_c"].map((id) => ({
  name: "presenter",
  type: "character" as const,
  properties: { type: "avatar" as const, character_id: id },
}));

type RpcCall = { name: string; args: Record<string, unknown> };

function makeDeps(orchestrateImpl?: RenderDeps["orchestrate"]) {
  const calls: RpcCall[] = [];
  const orchestrated: Array<Record<string, unknown> | undefined> = [];
  let genSeq = 0;
  const deps: RenderDeps = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "reserve_credits") return { data: true, error: null };
      return { data: null, error: null };
    },
    orchestrate:
      orchestrateImpl ??
      (async (req) => {
        orchestrated.push(req.params);
        return {
          url: `https://cdn.example/${(req.params?.variables as HeyGenTemplateVariables).presenter.type}.mp4`,
          provider: "heygen",
          endpoint: "heygen:template",
          latencyMs: 5,
          costUsd: 1.5,
        };
      }),
    insertGeneration: async () => ({ id: `gen_${++genSeq}` }),
  };
  return { deps, calls, orchestrated };
}

describe("renderAuroraTemplateCharacters credit flow", () => {
  it("reserves + commits once PER item with distinct reservation refs", async () => {
    const { deps, calls, orchestrated } = makeDeps();
    const out = await renderAuroraTemplateCharacters(tpl, "user_1", characters, {}, deps);

    expect(out.total).toBe(3);
    expect(out.succeeded).toBe(3);

    const reserves = calls.filter((c) => c.name === "reserve_credits");
    const commits = calls.filter((c) => c.name === "commit_reservation");
    expect(reserves).toHaveLength(3);
    expect(commits).toHaveLength(3);
    // No shared reservation: every item carries its own unique ref.
    const refs = reserves.map((c) => c.args._ref);
    expect(new Set(refs).size).toBe(3);
    // Same amount + reason per item — no batched/discounted mega-charge.
    for (const r of reserves) expect(r.args._reason).toBe("aurora_template");
    expect(new Set(reserves.map((r) => r.args._amount)).size).toBe(1);

    // Fixed variables identical across every dispatch; only the character varies.
    expect(orchestrated).toHaveLength(3);
    const headlines = orchestrated.map(
      (p) => (p?.variables as HeyGenTemplateVariables).headline,
    );
    expect(headlines[1]).toEqual(headlines[0]);
    expect(headlines[2]).toEqual(headlines[0]);
    const charIds = orchestrated.map(
      (p) =>
        (
          (p?.variables as HeyGenTemplateVariables).presenter as Extract<
            HeyGenTemplateVariable,
            { type: "character" }
          >
        ).properties.character_id,
    );
    expect(new Set(charIds)).toEqual(new Set(["av_a", "av_b", "av_c"]));
    // Every dispatch is pinned to the template model + carries the template id.
    for (const p of orchestrated) expect(p?.templateId).toBe("hg_tpl_9");
  });

  it("one failing item releases only its own reservation; the rest commit", async () => {
    const { deps, calls } = makeDeps(async (req) => {
      const vars = req.params?.variables as HeyGenTemplateVariables;
      const cid = (
        vars.presenter as Extract<HeyGenTemplateVariable, { type: "character" }>
      ).properties.character_id;
      if (cid === "av_b") throw new Error("HeyGen template generate failed [500]");
      return {
        url: "https://cdn.example/ok.mp4",
        provider: "heygen",
        endpoint: "heygen:template",
        latencyMs: 5,
        costUsd: 1.5,
      };
    });

    const out = await renderAuroraTemplateCharacters(tpl, "user_1", characters, {}, deps);

    expect(out.total).toBe(3);
    expect(out.succeeded).toBe(2);
    expect(out.results.filter((r) => !r.ok)).toHaveLength(1);

    expect(calls.filter((c) => c.name === "reserve_credits")).toHaveLength(3);
    expect(calls.filter((c) => c.name === "commit_reservation")).toHaveLength(2);
    const releases = calls.filter((c) => c.name === "release_reservation");
    expect(releases).toHaveLength(1);
    // The released ref belongs to a reservation that was never committed.
    const committedRefs = new Set(
      calls.filter((c) => c.name === "commit_reservation").map((c) => c.args._ref),
    );
    expect(committedRefs.has(releases[0].args._ref)).toBe(false);
  });
});
