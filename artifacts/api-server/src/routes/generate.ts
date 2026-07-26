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
import { serializeGen } from "./dashboard";

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
  photo: 15,
  video: 60,
  lipsync: 45,
  ugc: 30,
  music_video: 90,
} as const;

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

// Simulate async processing — in production this would call real AI providers
async function startProcessing(generationId: string, type: string) {
  const delay = ESTIMATED_SECONDS[type as keyof typeof ESTIMATED_SECONDS] ?? 30;

  setTimeout(async () => {
    try {
      // Mark as processing
      await db
        .update(generationsTable)
        .set({ status: "processing", progress: 20 })
        .where(eq(generationsTable.id, generationId));

      // Simulate progress
      await new Promise((r) => setTimeout(r, delay * 300));

      await db
        .update(generationsTable)
        .set({ progress: 70 })
        .where(eq(generationsTable.id, generationId));

      await new Promise((r) => setTimeout(r, delay * 300));

      // Demo output URLs by type (in production, these come from AI providers)
      const demoOutputs: Record<string, { url: string; thumb: string }> = {
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

      const output = demoOutputs[type] ?? demoOutputs["photo"]!;

      await db
        .update(generationsTable)
        .set({
          status: "completed",
          outputUrl: output.url,
          thumbnailUrl: output.thumb,
          progress: 100,
          completedAt: new Date(),
        })
        .where(eq(generationsTable.id, generationId));
    } catch {
      await db
        .update(generationsTable)
        .set({ status: "failed", errorMessage: "Processing failed" })
        .where(eq(generationsTable.id, generationId));
    }
  }, 1000);
}

// POST /generate/photo
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

  const gen = await createGeneration(req.userId, "photo", parsed.data.prompt, parsed.data.provider ?? "auto", cost);
  startProcessing(gen.id, "photo");

  res.status(202).json({
    id: gen.id,
    status: "queued",
    creditsUsed: cost,
    estimatedSeconds: ESTIMATED_SECONDS.photo,
    remainingCredits: remaining,
  });
});

// POST /generate/video
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

  const gen = await createGeneration(req.userId, "video", parsed.data.prompt, parsed.data.provider ?? "auto", cost);
  startProcessing(gen.id, "video");

  res.status(202).json({
    id: gen.id,
    status: "queued",
    creditsUsed: cost,
    estimatedSeconds: ESTIMATED_SECONDS.video,
    remainingCredits: remaining,
  });
});

// POST /generate/lipsync
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

  const gen = await createGeneration(req.userId, "lipsync", undefined, parsed.data.provider ?? "auto", cost);
  startProcessing(gen.id, "lipsync");

  res.status(202).json({
    id: gen.id,
    status: "queued",
    creditsUsed: cost,
    estimatedSeconds: ESTIMATED_SECONDS.lipsync,
    remainingCredits: remaining,
  });
});

// POST /generate/ugc
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

  const gen = await createGeneration(req.userId, "ugc", parsed.data.prompt, "auto", cost);
  startProcessing(gen.id, "ugc");

  res.status(202).json({
    id: gen.id,
    status: "queued",
    creditsUsed: cost,
    estimatedSeconds: ESTIMATED_SECONDS.ugc,
    remainingCredits: remaining,
  });
});

// POST /generate/music-video
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

  const gen = await createGeneration(req.userId, "music_video", parsed.data.prompt, "auto", cost);
  startProcessing(gen.id, "music_video");

  res.status(202).json({
    id: gen.id,
    status: "queued",
    creditsUsed: cost,
    estimatedSeconds: ESTIMATED_SECONDS.music_video,
    remainingCredits: remaining,
  });
});

// GET /generate/:id — status polling
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

// GET /generate/recent
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

export default router;
