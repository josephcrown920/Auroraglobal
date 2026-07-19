import { describe, expect, it } from "bun:test";
import { computeCost, COST_UGC_AD, COST_AUTOCUT } from "./pricing";
import {
  STUDIO_TEMPLATES,
  CATEGORY_ORDER,
  TEMPLATE_DEFAULTS,
  SPIN_PIECE_COUNT,
  templateCost,
  type StudioTemplate,
} from "./template-studio";
import { COST_UGC_AD as SERVER_COST_UGC_AD } from "./ugc.server";
import { COST_AUTOCUT as SERVER_COST_AUTOCUT } from "./autocut.server";
import { SPIN_COUNT, SPIN_PIECE_COST } from "./spin-engine";

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

  it("flat-rate server costs re-export from pricing.ts (single source)", () => {
    // ugc.server and autocut.server must re-export the same value as pricing.ts,
    // not define their own. This test fails the moment either file re-introduces
    // a local constant that diverges from the canonical price list.
    expect(SERVER_COST_UGC_AD).toBe(COST_UGC_AD);
    expect(SERVER_COST_AUTOCUT).toBe(COST_AUTOCUT);
    // Spin batch count must match so SPIN_PIECE_COUNT labels agree with spinThirty.
    expect(SPIN_PIECE_COUNT).toBe(SPIN_COUNT);
  });

  it("dispatch-flat costs match their backend charge", () => {
    for (const t of STUDIO_TEMPLATES) {
      if (t.dispatch === "ugc") {
        // generateUGCAd reserves exactly COST_UGC_AD (from pricing.ts).
        expect(templateCost(t)).toBe(COST_UGC_AD);
      } else if (t.dispatch === "spin") {
        // Spin templates navigate to /spin; no credits are reserved in the drawer.
        // The 300 Aura (SPIN_COUNT × SPIN_PIECE_COST) is charged on /spin when the
        // user explicitly clicks "Spin 30 posts" — templateCost returns 0 (Free).
        expect(templateCost(t)).toBe(0);
      } else if (t.dispatch === "autocut") {
        // createAutocutJob reserves exactly COST_AUTOCUT (from pricing.ts).
        expect(templateCost(t)).toBe(COST_AUTOCUT);
      }
    }
  });

  it("non-spin templates disclose a nonzero cost; spin templates are Free (charge on /spin)", () => {
    // Contract guard: any template that previews an Aura cost must route to a
    // backend that actually charges that amount (studio chain, UGC job, AutoCut
    // job) — no phantom charges and no undisclosed ones.
    // Spin dispatch is the ONE intentional exception: templateCost returns 0
    // because the drawer is a free launcher; the 300 Aura charge is disclosed and
    // collected on /spin itself when the user clicks "Spin 30 posts".
    for (const t of STUDIO_TEMPLATES) {
      if (t.dispatch === "spin") {
        expect(templateCost(t)).toBe(0); // Free in drawer, 300 Aura charged on /spin
      } else {
        expect(templateCost(t)).toBeGreaterThan(0);
      }
      expect(["studio", "ugc", "autocut", "spin"]).toContain(t.dispatch);
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
