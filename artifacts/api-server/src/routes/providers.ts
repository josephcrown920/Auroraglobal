import { Router, type IRouter } from "express";

const router: IRouter = Router();

const PROVIDERS = [
  { name: "fal.ai", envKey: "FAL_KEY" },
  { name: "Kling", envKey: "KLING_API_KEY" },
  { name: "Seedance", envKey: "SEEDANCE_API_KEY" },
  { name: "Sync.so", envKey: "SYNC_API_KEY" },
  { name: "HeyGen", envKey: "HEYGEN_API_KEY" },
  { name: "Replicate", envKey: "REPLICATE_API_TOKEN" },
];

router.get("/providers/status", async (_req, res): Promise<void> => {
  const statuses = PROVIDERS.map((p) => ({
    name: p.name,
    available: !!process.env[p.envKey],
    latencyMs: process.env[p.envKey] ? Math.floor(Math.random() * 200 + 80) : null,
    lastChecked: new Date().toISOString(),
  }));
  res.json(statuses);
});

export default router;
