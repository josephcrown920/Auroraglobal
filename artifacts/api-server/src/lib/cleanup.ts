import { db, generationsTable, usersTable, creditTransactionsTable } from "@workspace/db";
import { eq, and, or, isNull, lt, sql, inArray } from "drizzle-orm";
import { logger } from "./logger";

const STALE_THRESHOLD_MINUTES = 30;
const STALE_TIMEOUT_MESSAGE = "Generation timed out — please try again";

/**
 * Finds generations that have been stuck in "queued" or "processing" for more
 * than 30 minutes without a providerJobId (i.e. the server crashed before the
 * job was submitted), marks them "failed", and issues credit refunds.
 *
 * Returns the number of rows cleaned up.
 */
export async function cleanupStaleGenerations(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);

  // Find stale rows
  const stale = await db
    .select({
      id: generationsTable.id,
      userId: generationsTable.userId,
      creditsUsed: generationsTable.creditsUsed,
    })
    .from(generationsTable)
    .where(
      and(
        or(
          eq(generationsTable.status, "queued"),
          eq(generationsTable.status, "processing"),
        ),
        isNull(generationsTable.providerJobId),
        lt(generationsTable.createdAt, cutoff),
      ),
    );

  if (stale.length === 0) {
    return 0;
  }

  logger.info({ count: stale.length }, "[cleanup] marking stale generations as failed");

  const ids = stale.map((r) => r.id);

  // Mark all stale rows as failed in one statement
  await db
    .update(generationsTable)
    .set({
      status: "failed",
      errorMessage: STALE_TIMEOUT_MESSAGE,
    })
    .where(inArray(generationsTable.id, ids));

  // Issue credit refunds for each row that had credits deducted
  for (const row of stale) {
    if (row.creditsUsed <= 0) continue;

    try {
      const result = await db
        .update(usersTable)
        .set({ credits: sql`${usersTable.credits} + ${row.creditsUsed}` })
        .where(eq(usersTable.id, row.userId))
        .returning({ credits: usersTable.credits });

      const balanceAfter = result[0]?.credits ?? 0;

      await db.insert(creditTransactionsTable).values({
        userId: row.userId,
        amount: row.creditsUsed,
        type: "refund",
        description: `Credit refund: generation_timeout (generation ${row.id})`,
        reference: row.id,
        balanceAfter,
      });

      logger.info(
        { generationId: row.id, userId: row.userId, credits: row.creditsUsed },
        "[cleanup] refunded credits for stale generation",
      );
    } catch (err: any) {
      logger.error(
        { generationId: row.id, err: err?.message },
        "[cleanup] failed to refund credits for stale generation",
      );
    }
  }

  return stale.length;
}

/**
 * Starts a periodic cleanup interval that runs every 5 minutes.
 * Call once at server startup.
 */
export function startStaleGenerationCleanup(): void {
  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  // Run once shortly after startup, then on the interval
  setTimeout(async () => {
    try {
      const cleaned = await cleanupStaleGenerations();
      if (cleaned > 0) {
        logger.info({ cleaned }, "[cleanup] initial stale generation sweep complete");
      }
    } catch (err: any) {
      logger.error({ err: err?.message }, "[cleanup] initial stale generation sweep failed");
    }
  }, 10_000); // 10 seconds after startup

  setInterval(async () => {
    try {
      const cleaned = await cleanupStaleGenerations();
      if (cleaned > 0) {
        logger.info({ cleaned }, "[cleanup] periodic stale generation sweep complete");
      }
    } catch (err: any) {
      logger.error({ err: err?.message }, "[cleanup] periodic stale generation sweep failed");
    }
  }, INTERVAL_MS);
}
