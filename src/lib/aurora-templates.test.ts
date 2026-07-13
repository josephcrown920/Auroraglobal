// Task #275 — Aurora Template batch fan-out credit flow.
// Proves each batch item runs its OWN reserve → orchestrate → finalize cycle
// (distinct reservation refs, no shared/skipped reservations), and that one
// failing item releases only its own credits while the others still finalize.
//
// Task #214 update: generate-core now uses finalize_sync_render (atomic) instead
// of the old insertGeneration + commit_reservation two-step. Tests updated to
// assert finalize_sync_render calls instead of commit_reservation calls.
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
      if (name === "finalize_sync_render") return { data: `gen_${++genSeq}`, error: null };
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
  };
  return { deps, calls, orchestrated };
}

describe("renderAuroraTemplateCharacters credit flow", () => {
  it("reserves + finalizes atomically once PER item with distinct reservation refs", async () => {
    const { deps, calls, orchestrated } = makeDeps();
    const out = await renderAuroraTemplateCharacters(tpl, "user_1", characters, {}, deps);

    expect(out.total).toBe(3);
    expect(out.succeeded).toBe(3);

    const reserves = calls.filter((c) => c.name === "reserve_credits");
    const finalizes = calls.filter((c) => c.name === "finalize_sync_render");
    expect(reserves).toHaveLength(3);
    expect(finalizes).toHaveLength(3);
    // No shared reservation: every item carries its own unique ref.
    const refs = reserves.map((c) => c.args._ref);
    expect(new Set(refs).size).toBe(3);
    // Same amount + reason per item — no batched/discounted mega-charge.
    for (const r of reserves) expect(r.args._reason).toBe("aurora_template");
    expect(new Set(reserves.map((r) => r.args._amount)).size).toBe(1);

    // The old separate commit_reservation must not appear — credit commit
    // is folded into finalize_sync_render atomically (task #214).
    expect(calls.find((c) => c.name === "commit_reservation")).toBeUndefined();

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

  it("one failing item releases only its own reservation; the rest finalize atomically", async () => {
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
    // Two items succeed → two finalize_sync_render calls.
    expect(calls.filter((c) => c.name === "finalize_sync_render")).toHaveLength(2);
    // One item fails before finalize → one release_reservation call.
    const releases = calls.filter((c) => c.name === "release_reservation");
    expect(releases).toHaveLength(1);
    // The released ref must not appear in any finalize_sync_render call —
    // this ref was reserved but never finalized (Postgres never committed it).
    const finalizedRefs = new Set(
      calls.filter((c) => c.name === "finalize_sync_render").map((c) => c.args._ref),
    );
    expect(finalizedRefs.has(releases[0].args._ref)).toBe(false);
    // The old separate commit_reservation must not appear.
    expect(calls.find((c) => c.name === "commit_reservation")).toBeUndefined();
  });
});
