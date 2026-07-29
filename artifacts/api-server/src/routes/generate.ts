import { Router, type IRouter } from "express";
import { db, generationsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  GeneratePhotoBody,
  GenerateVideoBody,
  GenerateLipsyncBody,
  GenerateUgcBody,
  GenerateMusicVideoBody,
  GetGenerationStatusParams,
  GetRecentGenerationsQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { toAbsoluteMediaUrl } from "../lib/mediaUrl";
import { serializeGen } from "./dashboard";
import { sendPushToUser } from "../lib/push";
import {
  refundCredits,
  encodeProviderJobId,
  syncProviderStatus,
} from "../lib/generationSync";
import {
  hasFal,
  falSubmitPhoto,
  falSubmitUgc,
  falSubmitMusicVideo,
  resolveVideoProvider,
  resolveLipsyncProvider,
} from "../lib/providers";

const router: IRouter = Router();

// Credit costs per generation type
const CREDIT_COSTS = {
  photo: 2,
  video: 10,
  lipsync: 8,
  ugc: 6,
  music_video: 12,
} as const;

// Estimated processing times in seconds
const ESTIMATED_SECONDS = {
  photo: 30,
  video: 90,
  lipsync: 60,
  ugc: 60,
  music_video: 120,
} as const;

// Demo fallback outputs (used when no provider key is configured)
const DEMO_OUTPUTS: Record<string, { url: string; thumb: string }> = {
  photo: {
    url: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800",
    thumb: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
  },
  video: {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    thumb: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400",
  },
  lipsync: {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
    thumb: "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400",
  },
  ugc: {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazers.mp4",
    thumb: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400",
  },
  music_video: {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
    thumb: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400",
  },
};

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function deductCredits(userId: string, amount: number): Promise<{ success: boolean; remaining: number }> {
  const result = await db
    .update(usersTable)
    .set({
      credits: sql`GREATEST(0, ${usersTable.credits} - ${amount})`,
      totalGenerations: sql`${usersTable.totalGenerations} + 1`,
    })
    .where(
      and(
        eq(usersTable.id, userId),
        sql`${usersTable.credits} >= ${amount}`,
      ),
    )
    .returning({ credits: usersTable.credits });

  if (!result[0]) {
    return { success: false, remaining: 0 };
  }
  return { success: true, remaining: result[0].credits };
}

async function createGeneration(
  userId: string,
  type: keyof typeof CREDIT_COSTS,
  prompt: string | undefined,
  provider: string,
  creditsUsed: number,
) {
  const [gen] = await db
    .insert(generationsTable)
    .values({
      userId,
      type,
      status: "queued",
      prompt: prompt ?? null,
      provider,
      creditsUsed,
      isFavorited: false,
    })
    .returning();
  return gen;
}

// ─── Demo fallback simulation ─────────────────────────────────────────────────

/**
 * Used when no provider key is set.  Simulates progress and writes demo output
 * URLs directly to DB (same behaviour as before).
 */
function runDemoSimulation(generationId: string, type: string): void {
  const delay = ESTIMATED_SECONDS[type as keyof typeof ESTIMATED_SECONDS] ?? 30;

  setTimeout(async () => {
    try {
      await db
        .update(generationsTable)
        .set({ status: "processing", progress: 20 })
        .where(eq(generationsTable.id, generationId));

      await new Promise((r) => setTimeout(r, delay * 300));

      await db
        .update(generationsTable)
        .set({ progress: 70 })
        .where(eq(generationsTable.id, generationId));

      await new Promise((r) => setTimeout(r, delay * 300));

      const output = DEMO_OUTPUTS[type] ?? DEMO_OUTPUTS["photo"]!;

      // Atomic update: only fires push if the row wasn't already completed
      const updated = await db
        .update(generationsTable)
        .set({
          status: "completed",
          outputUrl: output.url,
          thumbnailUrl: output.thumb,
          progress: 100,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(generationsTable.id, generationId),
            sql`${generationsTable.status} != 'completed'`,
          ),
        )
        .returning({ userId: generationsTable.userId, type: generationsTable.type });

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
    } catch {
      await db
        .update(generationsTable)
        .set({ status: "failed", errorMessage: "Processing failed" })
        .where(eq(generationsTable.id, generationId));
    }
  }, 1000);
}

// ─── Photo generation ─────────────────────────────────────────────────────────

router.post("/generate/photo", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = GeneratePhotoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cost = CREDIT_COSTS.photo;
  const { success, remaining } = await deductCredits(req.userId, cost);
  if (!success) {
    res.status(402).json({ error: "Insufficient credits" });
    return;
  }

  const data = parsed.data;
  const useFal = hasFal() && (data.provider === "fal" || data.provider === "auto" || !data.provider);

  const gen = await createGeneration(
    req.userId,
    "photo",
    data.prompt,
    useFal ? "fal" : data.provider ?? "demo",
    cost,
  );

  if (useFal) {
    // Submit to fal.ai and store job ID; polling happens on GET /generate/:id
    (async () => {
      try {
        await db
          .update(generationsTable)
          .set({ status: "processing", progress: 5 })
          .where(eq(generationsTable.id, gen.id));

        const { jobId } = await falSubmitPhoto({
          prompt: data.prompt,
          style: data.style,
          aspectRatio: data.aspectRatio,
          referenceImageUrl: toAbsoluteMediaUrl(data.referenceImageUrl),
          numImages: data.numImages,
        });

        await db
          .update(generationsTable)
          .set({ providerJobId: encodeProviderJobId("fal-photo", jobId) })
          .where(eq(generationsTable.id, gen.id));
      } catch (err: any) {
        console.error("[fal] photo submit error:", err?.message);
        await db
          .update(generationsTable)
          .set({ status: "failed", errorMessage: err?.message ?? "Failed to submit to fal.ai" })
          .where(eq(generationsTable.id, gen.id));
        await refundCredits(req.userId, cost, gen.id, "provider_failure");
      }
    })();
  } else {
    runDemoSimulation(gen.id, "photo");
  }

  res.status(202).json({
    id: gen.id,
    status: "queued",
    creditsUsed: cost,
    estimatedSeconds: ESTIMATED_SECONDS.photo,
    remainingCredits: remaining,
  });
});

// ─── Video generation ─────────────────────────────────────────────────────────

router.post("/generate/video", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = GenerateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cost = CREDIT_COSTS.video;
  const { success, remaining } = await deductCredits(req.userId, cost);
  if (!success) {
    res.status(402).json({ error: "Insufficient credits" });
    return;
  }

  const data = parsed.data;
  const provider = resolveVideoProvider(data.provider);

  const gen = await createGeneration(
    req.userId,
    "video",
    data.prompt,
    provider?.name ?? "demo",
    cost,
  );

  if (provider) {
    (async () => {
      try {
        await db
          .update(generationsTable)
          .set({ status: "processing", progress: 5 })
          .where(eq(generationsTable.id, gen.id));

        const { jobId } = await provider.submit({
          prompt: data.prompt,
          duration: data.duration,
          style: data.style,
          sourceImageUrl: toAbsoluteMediaUrl(data.sourceImageUrl),
        });

        await db
          .update(generationsTable)
          .set({ providerJobId: encodeProviderJobId(provider.name, jobId) })
          .where(eq(generationsTable.id, gen.id));
      } catch (err: any) {
        console.error(`[${provider.name}] video submit error:`, err?.message);
        await db
          .update(generationsTable)
          .set({ status: "failed", errorMessage: err?.message ?? `Failed to submit to ${provider.name}` })
          .where(eq(generationsTable.id, gen.id));
        await refundCredits(req.userId, cost, gen.id, "provider_failure");
      }
    })();
  } else {
    runDemoSimulation(gen.id, "video");
  }

  res.status(202).json({
    id: gen.id,
    status: "queued",
    creditsUsed: cost,
    estimatedSeconds: ESTIMATED_SECONDS.video,
    remainingCredits: remaining,
  });
});

// ─── Lip-sync generation ──────────────────────────────────────────────────────

router.post("/generate/lipsync", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = GenerateLipsyncBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cost = CREDIT_COSTS.lipsync;
  const { success, remaining } = await deductCredits(req.userId, cost);
  if (!success) {
    res.status(402).json({ error: "Insufficient credits" });
    return;
  }

  const data = parsed.data;
  const provider = resolveLipsyncProvider(data.provider);

  const gen = await createGeneration(
    req.userId,
    "lipsync",
    undefined,
    provider?.name ?? "demo",
    cost,
  );

  if (provider) {
    (async () => {
      try {
        await db
          .update(generationsTable)
          .set({ status: "processing", progress: 5 })
          .where(eq(generationsTable.id, gen.id));

        const { jobId } = await provider.submit({
          videoUrl: toAbsoluteMediaUrl(data.videoUrl) as string,
          audioUrl: toAbsoluteMediaUrl(data.audioUrl) as string,
        });

        await db
          .update(generationsTable)
          .set({ providerJobId: encodeProviderJobId(provider.name, jobId) })
          .where(eq(generationsTable.id, gen.id));
      } catch (err: any) {
        console.error(`[${provider.name}] lipsync submit error:`, err?.message);
        await db
          .update(generationsTable)
          .set({ status: "failed", errorMessage: err?.message ?? `Failed to submit to ${provider.name}` })
          .where(eq(generationsTable.id, gen.id));
        await refundCredits(req.userId, cost, gen.id, "provider_failure");
      }
    })();
  } else {
    runDemoSimulation(gen.id, "lipsync");
  }

  res.status(202).json({
    id: gen.id,
    status: "queued",
    creditsUsed: cost,
    estimatedSeconds: ESTIMATED_SECONDS.lipsync,
    remainingCredits: remaining,
  });
});

// ─── UGC generation ───────────────────────────────────────────────────────────

router.post("/generate/ugc", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = GenerateUgcBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cost = CREDIT_COSTS.ugc;
  const { success, remaining } = await deductCredits(req.userId, cost);
  if (!success) {
    res.status(402).json({ error: "Insufficient credits" });
    return;
  }

  const data = parsed.data;
  const useFal = hasFal();

  const gen = await createGeneration(
    req.userId,
    "ugc",
    data.prompt,
    useFal ? "fal" : "demo",
    cost,
  );

  if (useFal) {
    (async () => {
      try {
        await db
          .update(generationsTable)
          .set({ status: "processing", progress: 5 })
          .where(eq(generationsTable.id, gen.id));

        const { jobId } = await falSubmitUgc({
          prompt: data.prompt,
          productDescription: data.productDescription,
          avatarStyle: data.avatarStyle,
          platform: data.platform,
        });

        await db
          .update(generationsTable)
          .set({ providerJobId: encodeProviderJobId("fal-ugc", jobId) })
          .where(eq(generationsTable.id, gen.id));
      } catch (err: any) {
        console.error("[fal] UGC submit error:", err?.message);
        await db
          .update(generationsTable)
          .set({ status: "failed", errorMessage: err?.message ?? "Failed to submit UGC to fal.ai" })
          .where(eq(generationsTable.id, gen.id));
        await refundCredits(req.userId, cost, gen.id, "provider_failure");
      }
    })();
  } else {
    runDemoSimulation(gen.id, "ugc");
  }

  res.status(202).json({
    id: gen.id,
    status: "queued",
    creditsUsed: cost,
    estimatedSeconds: ESTIMATED_SECONDS.ugc,
    remainingCredits: remaining,
  });
});

// ─── Music video generation ───────────────────────────────────────────────────

router.post("/generate/music-video", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = GenerateMusicVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cost = CREDIT_COSTS.music_video;
  const { success, remaining } = await deductCredits(req.userId, cost);
  if (!success) {
    res.status(402).json({ error: "Insufficient credits" });
    return;
  }

  const data = parsed.data;
  const useFal = hasFal();

  const gen = await createGeneration(
    req.userId,
    "music_video",
    data.prompt,
    useFal ? "fal" : "demo",
    cost,
  );

  if (useFal) {
    (async () => {
      try {
        await db
          .update(generationsTable)
          .set({ status: "processing", progress: 5 })
          .where(eq(generationsTable.id, gen.id));

        const { jobId } = await falSubmitMusicVideo({
          prompt: data.prompt,
          audioUrl: toAbsoluteMediaUrl(data.audioUrl) as string,
          style: data.style,
          beatSync: data.beatSync,
        });

        await db
          .update(generationsTable)
          .set({ providerJobId: encodeProviderJobId("fal-music_video", jobId) })
          .where(eq(generationsTable.id, gen.id));
      } catch (err: any) {
        console.error("[fal] music-video submit error:", err?.message);
        await db
          .update(generationsTable)
          .set({ status: "failed", errorMessage: err?.message ?? "Failed to submit music video to fal.ai" })
          .where(eq(generationsTable.id, gen.id));
        await refundCredits(req.userId, cost, gen.id, "provider_failure");
      }
    })();
  } else {
    runDemoSimulation(gen.id, "music_video");
  }

  res.status(202).json({
    id: gen.id,
    status: "queued",
    creditsUsed: cost,
    estimatedSeconds: ESTIMATED_SECONDS.music_video,
    remainingCredits: remaining,
  });
});

// ─── Status polling ───────────────────────────────────────────────────────────

// GET /generate/recent  — must come BEFORE /generate/:id to avoid param capture
router.get("/generate/recent", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = GetRecentGenerationsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 10) : 10;

  const items = await db
    .select()
    .from(generationsTable)
    .where(eq(generationsTable.userId, req.userId))
    .orderBy(sql`${generationsTable.createdAt} DESC`)
    .limit(limit);

  res.json(items.map(serializeGen));
});

// GET /generate/:id
router.get("/generate/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = GetGenerationStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [gen] = await db
    .select()
    .from(generationsTable)
    .where(
      and(
        eq(generationsTable.id, params.data.id),
        eq(generationsTable.userId, req.userId),
      ),
    )
    .limit(1);

  if (!gen) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // If the job is still in-flight and has a real provider job ID, sync provider status
  if (
    gen.providerJobId &&
    gen.status !== "completed" &&
    gen.status !== "failed"
  ) {
    // Fire-and-forget: update DB then re-read, or just let the next poll pick it up.
    // We update in-place and return the fresh state.
    await syncProviderStatus(gen.id, gen.providerJobId, gen.type);

    // Re-read the updated row
    const [fresh] = await db
      .select()
      .from(generationsTable)
      .where(eq(generationsTable.id, gen.id))
      .limit(1);

    if (fresh) {
      res.json({
        id: fresh.id,
        status: fresh.status,
        type: fresh.type,
        outputUrl: fresh.outputUrl ?? null,
        thumbnailUrl: fresh.thumbnailUrl ?? null,
        errorMessage: fresh.errorMessage ?? null,
        progress: fresh.progress ?? null,
        createdAt: fresh.createdAt.toISOString(),
        completedAt: fresh.completedAt?.toISOString() ?? null,
      });
      return;
    }
  }

  res.json({
    id: gen.id,
    status: gen.status,
    type: gen.type,
    outputUrl: gen.outputUrl ?? null,
    thumbnailUrl: gen.thumbnailUrl ?? null,
    errorMessage: gen.errorMessage ?? null,
    progress: gen.progress ?? null,
    createdAt: gen.createdAt.toISOString(),
    completedAt: gen.completedAt?.toISOString() ?? null,
  });
});

export default router;
