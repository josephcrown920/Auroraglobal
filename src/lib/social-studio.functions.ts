"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isAdmin } from "@/lib/admin.server";
import { routedGenerate } from "@/lib/ai-router";
import { getAuroraMarketingFeature } from "@/lib/social-studio.catalog";

const ChannelSchema = z.enum(["instagram_feed", "instagram_carousel", "instagram_reel", "instagram_story"]);
const GoalSchema = z.enum(["launch", "feature_education", "announcement", "tutorial", "community", "conversion"]);
const ToneSchema = z.enum(["cinematic", "editorial", "playful", "technical", "artist_first"]);

const CampaignInputSchema = z.object({
  featureId: z.string().min(1).max(80),
  customCapability: z.string().trim().max(1200).optional(),
  goal: GoalSchema,
  tone: ToneSchema,
  channels: z.array(ChannelSchema).min(1).max(4),
  days: z.number().int().min(1).max(30),
  postCount: z.number().int().min(1).max(12),
  notes: z.string().trim().max(1200).optional(),
});

const CampaignItemSchema = z.object({
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
  slides: z
    .array(
      z.object({
        heading: z.string().min(1).max(100),
        body: z.string().min(1).max(260),
        visualPrompt: z.string().min(10).max(1000),
      }),
    )
    .max(8)
    .default([]),
});

const CampaignOutputSchema = z.object({
  name: z.string().min(2).max(140),
  strategy: z.string().min(20).max(800),
  items: z.array(CampaignItemSchema).min(1).max(12),
});

export type MarketingCampaignPlan = z.infer<typeof CampaignOutputSchema>;
export type MarketingCampaignItem = MarketingCampaignPlan["items"][number];
export type MarketingCampaignInput = z.infer<typeof CampaignInputSchema>;

export const generateMarketingCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => CampaignInputSchema.parse(value))
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) throw new Error("Forbidden — Aurora operators only");

    const feature = getAuroraMarketingFeature(data.featureId);
    if (!feature) throw new Error("Choose a valid Aurora feature");
    if (feature.id === "custom" && !data.customCapability?.trim()) {
      throw new Error("Describe the custom Aurora capability first");
    }

    const approvedFacts =
      feature.id === "custom"
        ? data.customCapability!.trim()
        : `${feature.promise} Proof available: ${feature.proof} Product route: ${feature.route}`;
    const channelMap = {
      instagram_feed: "Instagram feed post",
      instagram_carousel: "Instagram carousel",
      instagram_reel: "Instagram Reel",
      instagram_story: "Instagram Story",
    } as const;

    const prompt = [
      "Return valid JSON matching the supplied schema.",
      `Create an official Aurora Performance Studio social campaign for: ${feature.name}.`,
      `Approved capability facts (do not claim anything beyond these): ${approvedFacts}`,
      `Goal: ${data.goal}. Tone: ${data.tone}.`,
      `Campaign length: ${data.days} days. Produce exactly ${data.postCount} items.`,
      `Allowed channels: ${data.channels.map((channel) => channelMap[channel]).join(", ")}.`,
      data.notes ? `Operator direction: ${data.notes}` : "",
      "Distribute items across the requested days and allowed formats.",
      "Every item must make Aurora's capability visually understandable before the caption is read.",
      "For carousels provide 4-7 slides; each slide needs a concise heading, body, and image-generation prompt.",
      "For Reels provide a concrete 3-8 second motion prompt that demonstrates the feature, not generic cinematic footage.",
      "Visual prompts must use Aurora's violet/black premium identity, real product-interface or transformation language, strong mobile-safe composition, and no fake third-party logos.",
      "Captions should sound artist-led, specific, confident, and concise. Include a clear CTA and relevant non-spammy hashtags.",
      "Use stable unique lowercase IDs such as day-1-reel. recommendedTime should be a readable local time such as 6:30 PM.",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await routedGenerate({
      category: "SOCIAL_CONTENT",
      system:
        "You are Aurora Performance Studio's senior social creative director. You turn verified product capabilities into visual-first Instagram campaigns. Never invent product claims, metrics, testimonials, integrations, or availability.",
      prompt,
      schema: CampaignOutputSchema,
      estimatedCost: 0,
    });

    return {
      campaign: result.output,
      provider: result.provider,
      generatedAt: new Date().toISOString(),
      feature,
    };
  });