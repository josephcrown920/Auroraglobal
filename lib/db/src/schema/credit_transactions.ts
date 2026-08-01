import { pgTable, text, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const creditTransactionsTable = pgTable(
  "credit_transactions",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    amount: integer("amount").notNull(), // positive = credit, negative = debit
    type: text("type").notNull(), // topup | deduction | bonus | refund
    description: text("description").notNull(),
    reference: text("reference"), // Paystack reference or generation id
    balanceAfter: integer("balance_after").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Prevent duplicate refunds for the same generation at the DB level.
    // The partial uniqueness is enforced by filtering on type='refund' at
    // query time; the index itself covers all (reference, type) pairs so
    // Paystack top-ups with the same reference are also deduplicated.
    uniqueIndex("credit_transactions_reference_type_uidx")
      .on(t.reference, t.type)
      .where(sql`reference IS NOT NULL`),
  ],
);

export const insertCreditTransactionSchema = createInsertSchema(creditTransactionsTable).omit({ createdAt: true });
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;
