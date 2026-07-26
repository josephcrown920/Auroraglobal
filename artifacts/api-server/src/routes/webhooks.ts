import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";
import { db, usersTable, creditTransactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

const PACKAGE_PLAN_MAP: Record<string, string> = {
  starter_100: "starter",
  creator_500: "pro",
  pro_1200: "pro",
  studio_3000: "studio",
};

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

function verifyPaystackSignature(body: Buffer, signature: string | string[] | undefined): boolean {
  if (!PAYSTACK_SECRET_KEY || !signature || Array.isArray(signature)) return false;
  const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

async function verifyPaystackTransaction(reference: string): Promise<any | null> {
  if (!PAYSTACK_SECRET_KEY) return null;
  const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  });
  const data = (await response.json()) as any;
  return data?.status && data?.data ? data.data : null;
}

router.post("/", async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Buffer;
  const signature = req.headers["x-paystack-signature"];

  if (!PAYSTACK_SECRET_KEY) {
    res.status(500).json({ error: "Paystack not configured" });
    return;
  }

  if (!verifyPaystackSignature(body, signature)) {
    res.status(400).send("Invalid signature");
    return;
  }

  let event: any;
  try {
    event = JSON.parse(body.toString());
  } catch {
    res.status(400).send("Invalid JSON");
    return;
  }

  if (event.event !== "charge.success") {
    res.status(200).send("Ignored");
    return;
  }

  const tx = event.data as any;
  const reference = tx.reference as string;
  const metadata = tx.metadata || {};
  const userId = metadata.userId as string | undefined;
  const packageId = metadata.packageId as string | undefined;
  const creditsToAdd = metadata.credits as number | undefined;

  if (!userId || !packageId || typeof creditsToAdd !== "number") {
    res.status(400).send("Missing metadata");
    return;
  }

  // Idempotency: skip if already processed
  const [existing] = await db
    .select()
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.reference, reference))
    .limit(1);

  if (existing) {
    res.status(200).send("Already processed");
    return;
  }

  // Verify against Paystack to prevent spoofed metadata
  const verified = await verifyPaystackTransaction(reference);
  if (!verified || verified.status !== "success" || verified.amount !== tx.amount) {
    res.status(400).send("Verification failed");
    return;
  }

  const [user] = await db
    .select({ credits: usersTable.credits, plan: usersTable.plan })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    res.status(400).send("User not found");
    return;
  }

  const newCredits = user.credits + creditsToAdd;
  const newPlan = PACKAGE_PLAN_MAP[packageId] ?? user.plan;

  await db.transaction(async (trx) => {
    await trx
      .update(usersTable)
      .set({ credits: newCredits, plan: newPlan })
      .where(eq(usersTable.id, userId));

    await trx.insert(creditTransactionsTable).values({
      userId,
      amount: creditsToAdd,
      type: "topup",
      description: `Purchased ${packageId} via Paystack`,
      reference,
      balanceAfter: newCredits,
    });
  });

  res.status(200).send("OK");
});

export default router;
