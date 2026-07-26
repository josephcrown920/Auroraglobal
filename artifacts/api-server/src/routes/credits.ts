import { Router, type IRouter } from "express";
import { db, creditTransactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  GetCreditTransactionsQueryParams,
  CheckoutCreditsBody,
} from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

// Credit packages (Paystack NGN pricing)
const PACKAGES = [
  {
    id: "starter_100",
    name: "Starter",
    credits: 100,
    priceNgn: 2500,
    priceUsd: 1.5,
    popular: false,
    description: "Perfect for trying Aurora",
  },
  {
    id: "creator_500",
    name: "Creator",
    credits: 500,
    priceNgn: 10000,
    priceUsd: 7.0,
    popular: true,
    description: "Best value for active creators",
  },
  {
    id: "pro_1200",
    name: "Pro",
    credits: 1200,
    priceNgn: 20000,
    priceUsd: 15.0,
    popular: false,
    description: "For professionals and studios",
  },
  {
    id: "studio_3000",
    name: "Studio",
    credits: 3000,
    priceNgn: 45000,
    priceUsd: 32.0,
    popular: false,
    description: "Maximum power for heavy production",
  },
];

router.get("/credits/packages", async (_req, res): Promise<void> => {
  res.json(PACKAGES);
});

router.get("/credits/transactions", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = GetCreditTransactionsQueryParams.safeParse(req.query);
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const offset = parsed.success ? (parsed.data.offset ?? 0) : 0;

  const rows = await db
    .select()
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.userId, req.userId))
    .orderBy(sql`${creditTransactionsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(creditTransactionsTable)
    .where(eq(creditTransactionsTable.userId, req.userId));

  res.json({
    transactions: rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      type: r.type,
      description: r.description,
      reference: r.reference ?? null,
      balanceAfter: r.balanceAfter,
      createdAt: r.createdAt.toISOString(),
    })),
    total: Number(totalRow?.count ?? 0),
  });
});

router.post("/credits/checkout", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CheckoutCreditsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const pkg = PACKAGES.find((p) => p.id === parsed.data.packageId);
  if (!pkg) {
    res.status(400).json({ error: "Invalid package ID" });
    return;
  }

  const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
  const reference = `aurora_${req.userId}_${Date.now()}`;

  if (!paystackSecretKey) {
    // Return a demo URL if Paystack is not configured
    res.json({
      authorizationUrl: `https://paystack.com/demo/checkout?amount=${pkg.priceNgn * 100}&reference=${reference}`,
      reference,
    });
    return;
  }

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: parsed.data.email ?? `${req.userId}@aurora.app`,
      amount: pkg.priceNgn * 100, // kobo
      reference,
      metadata: {
        userId: req.userId,
        packageId: pkg.id,
        credits: pkg.credits,
      },
      callback_url: `${process.env.APP_URL ?? "https://aurora.app"}/settings?payment=success`,
    }),
  });

  const data = await response.json() as any;

  if (!data.status) {
    res.status(500).json({ error: "Failed to initialize payment" });
    return;
  }

  res.json({
    authorizationUrl: data.data.authorization_url,
    reference,
  });
});

export default router;
