import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

export default router;
