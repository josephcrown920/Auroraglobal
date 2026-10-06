import { createFileRoute } from "@tanstack/react-router";
import {
  COST_AUTOCUT,
  COST_PRODUCT_DEMO,
  COST_TIKTOK_REMIX_CUT,
  COST_UGC_AD,
  LIPSYNC_TIER_AURA,
  computeCost,
} from "@/lib/pricing";

const PUBLIC_PRICING = {
  version: 1,
  imageFrom: computeCost({ features: ["image"] }).total,
  videoFrom: computeCost({
    features: ["video"],
    model: "seedance-2.0-fast",
  }).total,
  lipSyncFrom: LIPSYNC_TIER_AURA.budget,
  motionFrom: computeCost({ features: ["motion"] }).total,
  performanceFrom: computeCost({
    features: ["video", "motion"],
    model: "seedance-2.0-fast",
  }).total,
  ugcAd: COST_UGC_AD,
  tiktokRemixCut: COST_TIKTOK_REMIX_CUT,
  productDemo: COST_PRODUCT_DEMO,
  autoCut: COST_AUTOCUT,
} as const;

export const Route = createFileRoute("/api/public/pricing")({
  server: {
    handlers: {
      GET: async () =>
        Response.json(PUBLIC_PRICING, {
          headers: {
            "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
          },
        }),
    },
  },
  component: () => null,
});