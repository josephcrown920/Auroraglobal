import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const creditTransactionsTable = pgTable("credit_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  amount: integer("amount").notNull(), // positive = credit, negative = debit
  type: text("type").notNull(), // topup | deduction | bonus | refund
  description: text("description").notNull(),
  reference: text("reference"), // Paystack reference
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactionsTable).omit({ createdAt: true });
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;
