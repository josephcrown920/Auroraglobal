import { z } from "zod";
import { isIsoDate } from "./social-studio.reliability";

const CampaignSlideSchema = z
  .object({
    heading: z.string().min(1).max(100),
    body: z.string().min(1).max(260),
    visualPrompt: z.string().min(10).max(1000),
  })
  .strict();

const RenderedAssetUrlSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "Rendered assets must use HTTPS");

const PlannerItemSchema = z
  .object({
    id: z.string().min(1).max(80),
    day: z.number().int().min(1).max(30),
    format: z.enum(["feed", "carousel", "reel", "story"]),
    title: z.string().min(2).max(140),
    hook: z.string().min(2).max(220),
    caption: z.string().min(20).max(2200),
    hashtags: z.array(z.string().min(1).max(60)).min(3).max(15),
    cta: z.string().min(2).max(180),
    visualPrompt: z.string().min(20).max(1800),
    reelPrompt: z.string().max(1800).optional(),
    recommendedTime: z.string().min(2).max(40),
    slides: z.array(CampaignSlideSchema).max(8),
  })
  .strict();

export const GeneratedCampaignSchema = z
  .object({
    name: z.string().min(2).max(140),
    strategy: z.string().min(20).max(800),
    items: z.array(PlannerItemSchema).min(1).max(12),
  })
  .strict()
  .superRefine((campaign, context) => {
    const seen = new Set<string>();
    campaign.items.forEach((item, index) => {
      if (seen.has(item.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "id"],
          message: "Campaign item ids must be unique",
        });
      }
      seen.add(item.id);
    });
  });

export type GeneratedCampaign = z.infer<typeof GeneratedCampaignSchema>;

export function parseGeneratedCampaign(value: unknown): GeneratedCampaign | null {
  const parsed = GeneratedCampaignSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const CampaignItemSchema = z
  .object({
    id: z.string().min(1).max(80),
    day: z.number().int().min(1).max(30),
    format: z.enum(["feed", "carousel", "reel", "story"]),
    title: z.string().min(2).max(140),
    hook: z.string().min(2).max(220),
    // Captions are generated with a server-side minimum, but this is a local
    // draft/editor schema: operators can temporarily clear or shorten a
    // caption while editing and reload without losing the campaign.
    caption: z.string().max(2200),
    hashtags: z.array(z.string().min(1).max(60)).min(3).max(15),
    cta: z.string().min(2).max(180),
    visualPrompt: z.string().min(20).max(1800),
    reelPrompt: z.string().max(1800).optional(),
    recommendedTime: z.string().min(2).max(40),
    slides: z.array(CampaignSlideSchema).max(8),
    assetUrls: z.array(RenderedAssetUrlSchema.nullable()).max(8),
    videoUrl: RenderedAssetUrlSchema.nullable(),
    // These three fields were added after the first Marketing Studio release.
    // Optional input keeps legacy campaigns loadable; the transform below
    // normalizes omissions to null so they can never look full-quality.
    videoGenerationId: z.string().uuid().nullable().optional(),
    reelPreviewId: z.string().uuid().nullable().optional(),
    reelPreviewUrl: RenderedAssetUrlSchema.nullable().optional(),
    status: z.enum(["draft", "approved", "scheduled", "published"]),
    scheduledDate: z
      .string()
      .refine((value) => value === "" || isIsoDate(value), "Expected an ISO calendar date"),
  })
  .strict()
  .superRefine((item, context) => {
    const metadataKeys = ["videoGenerationId", "reelPreviewId", "reelPreviewUrl"] as const;
    const presentMetadataKeys = metadataKeys.filter((key) =>
      Object.prototype.hasOwnProperty.call(item, key),
    );
    const hasAnyMetadata = presentMetadataKeys.length > 0;
    const hasAllMetadata = presentMetadataKeys.length === metadataKeys.length;
    if (hasAnyMetadata && !hasAllMetadata) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["videoGenerationId"],
        message: "Video and preview metadata must be stored together",
      });
    }

    const videoGenerationId = item.videoGenerationId ?? null;
    const reelPreviewId = item.reelPreviewId ?? null;
    const reelPreviewUrl = item.reelPreviewUrl ?? null;
    const hasPreviewId = reelPreviewId !== null;
    const hasPreviewUrl = reelPreviewUrl !== null;
    if (hasPreviewId !== hasPreviewUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reelPreviewId"],
        message: "Reel preview id and URL must be stored together",
      });
    }
    if (videoGenerationId !== null && item.videoUrl === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["videoGenerationId"],
        message: "Video metadata requires a video URL",
      });
    }
    if (reelPreviewId !== null && videoGenerationId !== reelPreviewId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reelPreviewId"],
        message: "Preview id must match the video generation id",
      });
    }
    if (reelPreviewUrl !== null && item.videoUrl !== reelPreviewUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reelPreviewUrl"],
        message: "Preview URL must match the current video URL",
      });
    }
  })
  .transform((item) => ({
    ...item,
    videoGenerationId: item.videoGenerationId ?? null,
    reelPreviewId: item.reelPreviewId ?? null,
    reelPreviewUrl: item.reelPreviewUrl ?? null,
  }));

export const StoredCampaignSchema = z
  .object({
    // Campaign ids are opaque local-storage keys. New campaigns use UUIDs,
    // while accepting a non-empty legacy/fixture key is safe because all async
    // writes are fenced by the current in-memory id.
    id: z.string().min(1).max(100),
    featureId: z.string().min(1).max(80),
    featureName: z.string().min(1).max(140),
    createdAt: z.string().datetime({ offset: true }),
    provider: z.string().min(1).max(80),
    name: z.string().min(2).max(140),
    strategy: z.string().min(20).max(800),
    items: z.array(CampaignItemSchema).min(1).max(12),
  })
  .strict()
  .superRefine((campaign, context) => {
    const seen = new Set<string>();
    campaign.items.forEach((item, index) => {
      if (seen.has(item.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "id"],
          message: "Campaign item ids must be unique",
        });
      }
      seen.add(item.id);
    });
  });

export type StoredCampaign = z.infer<typeof StoredCampaignSchema>;
export type StoredCampaignItem = StoredCampaign["items"][number];

/**
 * Parse, don't cast: localStorage is user-controlled input and can contain
 * stale versions, hand-edited JSON, or values from a different feature.
 */
export function parseStoredCampaign(value: unknown): StoredCampaign | null {
  const parsed = StoredCampaignSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}