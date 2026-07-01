import { describe, expect, it } from "bun:test";
import { computeCost } from "./pricing";
import {
  STUDIO_TEMPLATES,
  CATEGORY_ORDER,
  TEMPLATE_DEFAULTS,
  COST_UGC_AD,
  COST_AUTOCUT,
  SPIN_PIECE_COUNT,
  templateCost,
  type StudioTemplate,
} from "./template-studio";
import { COST_UGC_AD as SERVER_COST_UGC_AD } from "./ugc.server";
import { SPIN_COUNT } from "./spin-engine";

// Re-derive a studio template's cost straight from pricing.ts so the test fails
// if templateCost() ever drifts from what the pipeline actually charges.
function expectedStudioCost(t: StudioTemplate): number {
  let total = 0;
  for (const k of t.kinds) {
    if (k === "image") {
      total += computeCost({ features: ["image"] }).total;
    } else if (k === "video") {
      total += computeCost({
        features: ["video"],
        model: t.videoModel ?? TEMPLATE_DEFAULTS.videoModel,
        durationSeconds: t.durationSeconds ?? TEMPLATE_DEFAULTS.durationSeconds,
        resolution: t.resolution ?? TEMPLATE_DEFAULTS.resolution,
      }).total;
    } else if (k === "lipsync") {
      total += computeCost({
        features: ["lipsync"],
        model: t.lipsyncModel ?? TEMPLATE_DEFAULTS.lipsyncModel,
      }).total;
    }
  }
  return total;
}

describe("template-studio manifest", () => {
  it("uses exactly the six spec categories", () => {
    expect(CATEGORY_ORDER).toEqual(["Lip-sync", "Motion", "UGC/Ad", "Spin", "Kids", "Editing"]);
    // Every category is populated, and no template escapes the taxonomy.
    for (const cat of CATEGORY_ORDER) {
      expect(STUDIO_TEMPLATES.some((t) => t.category === cat)).toBe(true);
    }
    for (const t of STUDIO_TEMPLATES) {
      expect(CATEGORY_ORDER).toContain(t.category);
    }
  });

  it("every template declares orchestrator kinds + a dispatch backend", () => {
    const ids = STUDIO_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length); // ids are unique
    for (const t of STUDIO_TEMPLATES) {
      expect(t.kinds.length).toBeGreaterThan(0);
      expect(["studio", "ugc", "spin", "autocut"]).toContain(t.dispatch);
      if (t.dispatch === "ugc") expect(t.kinds).toContain("ugc_ad");
      if (t.dispatch === "spin") expect(t.kinds).toContain("spin");
      if (t.dispatch === "autocut") expect(t.kinds).toContain("autocut");
    }
  });

  it("UGC price stays in parity with its server constant; Spin batch matches", () => {
    expect(COST_UGC_AD).toBe(SERVER_COST_UGC_AD);
    expect(SPIN_PIECE_COUNT).toBe(SPIN_COUNT);
  });

  it("dispatch-flat costs match their backend charge", () => {
    for (const t of STUDIO_TEMPLATES) {
      if (t.dispatch === "ugc") {
        // generateUGCAd reserves exactly COST_UGC_AD.
        expect(templateCost(t)).toBe(SERVER_COST_UGC_AD);
      } else if (t.dispatch === "spin") {
        // The /spin experience is a free live preview — it must never claim a cost.
        expect(templateCost(t)).toBe(0);
      } else if (t.dispatch === "autocut") {
        // createAutocutJob reserves exactly COST_AUTOCUT.
        expect(templateCost(t)).toBe(COST_AUTOCUT);
      }
    }
  });

  it("only charging dispatches display a nonzero Aura cost", () => {
    // Contract guard: any template that previews a nonzero Aura cost must route to
    // a backend that actually charges that amount (studio chain or the UGC job) —
    // never the free /spin sim, which would be a phantom charge in the UI.
    for (const t of STUDIO_TEMPLATES) {
      if (templateCost(t) > 0) {
        expect(["studio", "ugc", "autocut"]).toContain(t.dispatch);
      } else {
        expect(t.dispatch).toBe("spin");
      }
    }
  });

  it("studio pipeline cost is the sum of each orchestrator kind", () => {
    const studio = STUDIO_TEMPLATES.filter((t) => t.dispatch === "studio");
    expect(studio.length).toBeGreaterThan(0);
    for (const t of studio) {
      expect(templateCost(t)).toBe(expectedStudioCost(t));
    }
  });
});
