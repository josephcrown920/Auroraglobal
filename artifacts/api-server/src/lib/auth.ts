import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

/**
 * Middleware: require a valid Clerk session.
 * Attaches req.userId (Clerk user ID) and req.dbUser (DB row, JIT-provisioned).
 */
export async function requireAuth(
  req: Request & { userId?: string },
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req as any);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}

/**
 * JIT-provision a user row in the DB if it doesn't exist yet.
 * Returns the user row (or null if not authenticated).
 */
export async function getOrCreateUser(userId: string, email?: string) {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (existing) return existing;

  // New user — create with 50 free credits
  const [created] = await db
    .insert(usersTable)
    .values({
      id: userId,
      email: email ?? `${userId}@aurora.app`,
      credits: 50,
      plan: "free",
      totalGenerations: 0,
    })
    .returning();

  return created;
}
