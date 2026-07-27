import { Router, type IRouter } from "express";
import { cleanupStaleGenerations } from "../lib/cleanup";

const router: IRouter = Router();

/**
 * POST /api/admin/cleanup-stale
 * Manually triggers the stale-generation cleanup job.
 * No auth required (internal/admin use; restrict at infra layer if needed).
 */
router.post("/admin/cleanup-stale", async (_req, res): Promise<void> => {
  try {
    const cleaned = await cleanupStaleGenerations();
    res.json({ ok: true, cleaned });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? "Cleanup failed" });
  }
});

export default router;
