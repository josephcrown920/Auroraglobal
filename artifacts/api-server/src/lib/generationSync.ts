/**
 * generationSync.ts
 *
 * Shared helpers for:
 *   - refunding credits on failure
 *   - polling a provider job and updating the DB to completed/failed/processing
 *
 * Used by both the HTTP route (GET /generate/:id) and the server-side
 * background poller so completions are detected even when the app is closed.
 */
import { db, generationsTable, usersTable, creditTransactionsTable } from "@workspace/db";
import { eq, and, ne, sql } from "drizzle-orm";
import { sendPushToUser } from "./push";
import {
  falPollPhoto,
  falPollVideo,
  falPollUgc,
  falPollMusicVideo,
  klingPollVideo,
  seedancePollVideo,
  syncPollLipsync,
  heygenPollLipsync,
  type ProviderStatus,
} from "./providers";

// ─── Credit helpers ───────────────────────────────────────────────────────────

export async function refundCredits(
  userId: string,
  amount: number,
  generationId: string,
  reason: string = "provider_failure",
): Promise<void> {
  const result = await db
    .update(usersTable)
    .set({ credits: sql`${usersTable.credits} + ${amount}` })
    .where(eq(usersTable.id, userId))
    .returning({ credits: usersTable.credits });

  const balanceAfter = result[0]?.credits ?? 0;

  await db.insert(creditTransactionsTable).values({
    userId,
    amount,
    type: "refund",
    description: `Credit refund: ${reason} (generation ${generationId})`,
    reference: generationId,
    balanceAfter,
  });
}

// ─── Provider ID codec ────────────────────────────────────────────────────────

export function encodeProviderJobId(providerName: string, jobId: string): string {
  return `${providerName}:${jobId}`;
}

export function decodeProviderJobId(raw: string): { providerName: string; jobId: string } | null {
  const idx = raw.indexOf(":");
  if (idx < 1) return null;
  return { providerName: raw.slice(0, idx), jobId: raw.slice(idx + 1) };
}

// ─── Core sync ────────────────────────────────────────────────────────────────

/**
 * Poll a provider job and update the DB row when done.
 *
 * The "completed" update is guarded by `status != 'completed'` so concurrent
 * calls (client poll + background poller) can only fire the push notification
 * once — whichever update actually changes the row wins.
 */
export async function syncProviderStatus(
  generationId: string,
  providerJobId: string,
  type: string,
): Promise<void> {
  const decoded = decodeProviderJobId(providerJobId);
  if (!decoded) return;

  const { providerName, jobId } = decoded;

  let result: ProviderStatus | null = null;

  try {
    switch (providerName) {
      case "fal-photo":    result = await falPollPhoto(jobId);    break;
      case "fal-video":    result = await falPollVideo(jobId);    break;
      case "fal-ugc":      result = await falPollUgc(jobId);      break;
      case "fal-music_video": result = await falPollMusicVideo(jobId); break;
      case "kling":        result = await klingPollVideo(jobId);  break;
      case "seedance":     result = await seedancePollVideo(jobId); break;
      case "sync":         result = await syncPollLipsync(jobId); break;
      case "heygen":       result = await heygenPollLipsync(jobId); break;
      default:             return;
    }
  } catch (err: any) {
    console.error(`[providers] poll error for ${providerName} job ${jobId}:`, err?.message);
    return;
  }

  if (!result) return;

  if (result.status === "completed") {
    // Atomic update: only proceed if the row is NOT already completed.
    // This prevents duplicate push notifications when the client poll and the
    // background poller both see a completed provider job around the same time.
    const updated = await db
      .update(generationsTable)
      .set({
        status: "completed",
        outputUrl: result.outputUrl,
        thumbnailUrl: result.thumbnailUrl ?? result.outputUrl ?? null,
        progress: 100,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(generationsTable.id, generationId),
          ne(generationsTable.status, "completed"),
        ),
      )
      .returning({
        userId: generationsTable.userId,
        type: generationsTable.type,
      });

    // Only send push if we actually changed the row (i.e. it wasn't already completed)
    if (updated[0]) {
      const { userId, type: genType } = updated[0];
      const typeLabel =
        genType === "photo" ? "Photo"
        : genType === "video" ? "Video"
        : genType === "lipsync" ? "Lip Sync"
        : genType === "music_video" ? "Music Video"
        : "Generation";

      sendPushToUser(
        userId,
        `${typeLabel} ready! 🎉`,
        "Your generation has finished — tap to view it in your Gallery.",
        { screen: "gallery", generationId },
      );
    }
  } else if (result.status === "failed") {
    // Atomic update: only transitions non-terminal rows to "failed".
    // Using a single conditional UPDATE + RETURNING means exactly one concurrent
    // caller wins the status change — preventing duplicate credit refunds when
    // both the background poller and a client poll observe the failure at once.
    const updated = await db
      .update(generationsTable)
      .set({ status: "failed", errorMessage: result.error ?? "Provider job failed" })
      .where(
        and(
          eq(generationsTable.id, generationId),
          ne(generationsTable.status, "failed"),
          ne(generationsTable.status, "completed"),
        ),
      )
      .returning({
        userId: generationsTable.userId,
        creditsUsed: generationsTable.creditsUsed,
      });

    // Only refund if we were the caller that changed the row
    if (updated[0] && updated[0].creditsUsed > 0) {
      await refundCredits(updated[0].userId, updated[0].creditsUsed, generationId, "provider_failure");
    }
  } else {
    // processing — update progress only
    await db
      .update(generationsTable)
      .set({ status: "processing", progress: result.progress ?? 30 })
      .where(eq(generationsTable.id, generationId));
  }
}
