import { Router, type IRouter } from "express";
import { db, generationsTable } from "@workspace/db";
import { eq, and, sql, count } from "drizzle-orm";
import {
  GetGalleryQueryParams,
  GetGalleryItemParams,
  DeleteGalleryItemParams,
  ToggleFavoriteParams,
  ToggleFavoriteBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { serializeGen } from "./dashboard";

const router: IRouter = Router();

router.get("/gallery", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = GetGalleryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { type, favorited, limit = 24, offset = 0 } = parsed.data;

  const conditions: any[] = [eq(generationsTable.userId, req.userId)];
  if (type) conditions.push(eq(generationsTable.type, type));
  if (favorited !== undefined) conditions.push(eq(generationsTable.isFavorited, favorited));

  const where = and(...conditions);

  const [totalRow] = await db
    .select({ count: count() })
    .from(generationsTable)
    .where(where);

  const items = await db
    .select()
    .from(generationsTable)
    .where(where)
    .orderBy(sql`${generationsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    items: items.map(serializeGen),
    total: Number(totalRow?.count ?? 0),
    limit,
    offset,
  });
});

router.get("/gallery/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = GetGalleryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [item] = await db
    .select()
    .from(generationsTable)
    .where(
      and(
        eq(generationsTable.id, params.data.id),
        eq(generationsTable.userId, req.userId),
      ),
    )
    .limit(1);

  if (!item) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(serializeGen(item));
});

router.delete("/gallery/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteGalleryItemParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(generationsTable)
    .where(
      and(
        eq(generationsTable.id, params.data.id),
        eq(generationsTable.userId, req.userId),
      ),
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ success: true });
});

router.patch("/gallery/:id/favorite", requireAuth, async (req: any, res): Promise<void> => {
  const params = ToggleFavoriteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ToggleFavoriteBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db
    .update(generationsTable)
    .set({ isFavorited: body.data.favorited })
    .where(
      and(
        eq(generationsTable.id, params.data.id),
        eq(generationsTable.userId, req.userId),
      ),
    )
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(serializeGen(updated));
});

export default router;
