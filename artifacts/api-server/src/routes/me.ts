import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable, pushTokensTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { UpdateProfileBody } from "@workspace/api-zod";
import { requireAuth, getOrCreateUser } from "../lib/auth";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req: any, res): Promise<void> => {
  const auth = getAuth(req);
  const email = auth?.sessionClaims?.email as string | undefined;
  const user = await getOrCreateUser(req.userId, email);

  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    credits: user.credits,
    plan: user.plan,
    totalGenerations: user.totalGenerations,
    createdAt: user.createdAt.toISOString(),
  });
});

router.patch("/me/profile", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({
      displayName: parsed.data.displayName,
      avatarUrl: parsed.data.avatarUrl,
    })
    .where(eq(usersTable.id, req.userId))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    credits: user.credits,
    plan: user.plan,
    totalGenerations: user.totalGenerations,
    createdAt: user.createdAt.toISOString(),
  });
});

// ─── Push token registration ──────────────────────────────────────────────────

router.post("/me/push-token", requireAuth, async (req: any, res): Promise<void> => {
  const { token } = req.body ?? {};
  if (typeof token !== "string" || !token.startsWith("ExponentPushToken[")) {
    res.status(400).json({ error: "Invalid Expo push token" });
    return;
  }

  await db
    .insert(pushTokensTable)
    .values({ userId: req.userId, token })
    .onConflictDoNothing();

  res.json({ ok: true });
});

router.delete("/me/push-token", requireAuth, async (req: any, res): Promise<void> => {
  const { token } = req.body ?? {};
  if (typeof token !== "string") {
    res.status(400).json({ error: "token required" });
    return;
  }

  await db
    .delete(pushTokensTable)
    .where(and(eq(pushTokensTable.userId, req.userId), eq(pushTokensTable.token, token)));

  res.json({ ok: true });
});

export default router;
