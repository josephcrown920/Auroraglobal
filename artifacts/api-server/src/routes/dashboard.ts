import { Router, type IRouter } from "express";
import { db, usersTable, generationsTable, creditTransactionsTable } from "@workspace/db";
import { eq, and, gte, count, sql, desc } from "drizzle-orm";
import { requireAuth, getOrCreateUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/dashboard", requireAuth, async (req: any, res): Promise<void> => {
  const user = await getOrCreateUser(req.userId);

  // Start of current month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Count by type
  const byTypeRows = await db
    .select({
      type: generationsTable.type,
      count: count(),
    })
    .from(generationsTable)
    .where(eq(generationsTable.userId, req.userId))
    .groupBy(generationsTable.type);

  // This month count + credits used
  const thisMonthRows = await db
    .select({
      count: count(),
      creditsUsed: sql<number>`COALESCE(SUM(${generationsTable.creditsUsed}), 0)`,
    })
    .from(generationsTable)
    .where(
      and(
        eq(generationsTable.userId, req.userId),
        gte(generationsTable.createdAt, monthStart),
      ),
    );

  // Favorite count
  const favoriteRows = await db
    .select({ count: count() })
    .from(generationsTable)
    .where(
      and(
        eq(generationsTable.userId, req.userId),
        eq(generationsTable.isFavorited, true),
      ),
    );

  // Recent 6 completed items
  const recentItems = await db
    .select()
    .from(generationsTable)
    .where(
      and(
        eq(generationsTable.userId, req.userId),
        eq(generationsTable.status, "completed"),
      ),
    )
    .orderBy(sql`${generationsTable.createdAt} DESC`)
    .limit(6);

  const byTypeMap: Record<string, number> = {};
  for (const r of byTypeRows) byTypeMap[r.type] = Number(r.count);

  res.json({
    credits: user.credits,
    totalGenerations: user.totalGenerations,
    thisMonthGenerations: Number(thisMonthRows[0]?.count ?? 0),
    photoCount: byTypeMap["photo"] ?? 0,
    videoCount: byTypeMap["video"] ?? 0,
    lipsyncCount: byTypeMap["lipsync"] ?? 0,
    ugcCount: byTypeMap["ugc"] ?? 0,
    byType: byTypeRows.map((r) => ({ type: r.type, count: Number(r.count) })),
    recentActivity: recentItems.map(serializeGen),
    creditsUsedThisMonth: Number(thisMonthRows[0]?.creditsUsed ?? 0),
    favoriteCount: Number(favoriteRows[0]?.count ?? 0),
  });
});

router.get("/dashboard/credit-history", requireAuth, async (req: any, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);

  const transactions = await db
    .select()
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.userId, req.userId))
    .orderBy(desc(creditTransactionsTable.createdAt))
    .limit(limit);

  res.json(
    transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      reference: t.reference ?? null,
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt.toISOString(),
    })),
  );
});

function serializeGen(g: any) {
  return {
    id: g.id,
    type: g.type,
    status: g.status,
    prompt: g.prompt ?? null,
    outputUrl: g.outputUrl ?? null,
    thumbnailUrl: g.thumbnailUrl ?? null,
    provider: g.provider ?? null,
    creditsUsed: g.creditsUsed,
    isFavorited: g.isFavorited,
    metadataJson: g.metadataJson ?? null,
    createdAt: g.createdAt.toISOString(),
    completedAt: g.completedAt?.toISOString() ?? null,
  };
}

export { serializeGen };
export default router;
