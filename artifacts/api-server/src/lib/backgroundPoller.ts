/**
 * backgroundPoller.ts
 *
 * Server-side poller that periodically checks all in-flight generations that
 * have a real provider job ID and syncs their status with the provider.
 *
 * This is the mechanism that fires push notifications when the mobile app is
 * backgrounded or closed — we don't rely on the client calling GET /generate/:id.
 */
import { db, generationsTable } from "@workspace/db";
import { and, inArray, isNotNull, ne } from "drizzle-orm";
import { syncProviderStatus } from "./generationSync";
import { logger } from "./logger";

const POLL_INTERVAL_MS = 15_000; // poll every 15 s
const INITIAL_DELAY_MS = 12_000; // give the server a moment to fully start

async function pollInFlightGenerations(): Promise<void> {
  try {
    // Find all non-demo in-flight generations
    const inFlight = await db
      .select({
        id: generationsTable.id,
        providerJobId: generationsTable.providerJobId,
        type: generationsTable.type,
      })
      .from(generationsTable)
      .where(
        and(
          inArray(generationsTable.status, ["queued", "processing"]),
          isNotNull(generationsTable.providerJobId),
          // Exclude demo provider rows — they manage themselves via setTimeout
          ne(generationsTable.providerJobId!, "demo"),
        ),
      );

    if (inFlight.length === 0) return;

    logger.debug({ count: inFlight.length }, "[backgroundPoller] syncing in-flight generations");

    // Fan out concurrently — each syncProviderStatus call is idempotent
    await Promise.allSettled(
      inFlight.map((gen) =>
        syncProviderStatus(gen.id, gen.providerJobId!, gen.type).catch((err) => {
          logger.error(
            { generationId: gen.id, err: err?.message },
            "[backgroundPoller] syncProviderStatus error",
          );
        }),
      ),
    );
  } catch (err: any) {
    logger.error({ err: err?.message }, "[backgroundPoller] poll sweep failed");
  }
}

/**
 * Start the background generation poller. Call once at server startup.
 */
export function startBackgroundPoller(): void {
  // Short initial delay so the server is fully ready before the first sweep
  setTimeout(() => {
    pollInFlightGenerations();
    setInterval(pollInFlightGenerations, POLL_INTERVAL_MS);
  }, INITIAL_DELAY_MS);

  logger.info(
    { pollIntervalMs: POLL_INTERVAL_MS },
    "[backgroundPoller] started",
  );
}
