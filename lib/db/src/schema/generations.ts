import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const generationsTable = pgTable("generations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  type: text("type").notNull(), // photo | video | lipsync | ugc | music_video
  status: text("status").notNull().default("queued"), // queued | processing | completed | failed
  prompt: text("prompt"),
  outputUrl: text("output_url"),
  thumbnailUrl: text("thumbnail_url"),
  provider: text("provider"),
  creditsUsed: integer("credits_used").notNull().default(0),
  isFavorited: boolean("is_favorited").notNull().default(false),
  metadataJson: text("metadata_json"),
  errorMessage: text("error_message"),
  progress: integer("progress"),
  // Store provider-specific job ID for polling
  providerJobId: text("provider_job_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertGenerationSchema = createInsertSchema(generationsTable).omit({ createdAt: true });
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generationsTable.$inferSelect;
