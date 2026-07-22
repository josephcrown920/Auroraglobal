import { z } from "zod";

/**
 * Shared shape for Guided Workflows — admin-curated, step-by-step viral video
 * playbooks users can run inside Aurora (/guides). The same zod schema
 * validates the seed content, the admin editor payload (server-side), and the
 * rows the runner renders, so the three surfaces can never drift apart.
 *
 * This module is CLIENT-SAFE: no *.server imports (see
 * aurora-client-safe-cost-helpers memory).
 */

/** Internal routes a step is allowed to deep-link into (allowlist — the admin
 * editor is trusted-ish, but a stray external URL here would be a phishing
 * surface on a page we tell users to follow step by step). */
export const TOOL_LINK_ROUTES = [
  "/colors",
  "/motion",
  "/lipsync",
  "/reshoot",
  "/orchestrate",
  "/studio",
  "/templates",
  "/agent",
  "/edit",
] as const;
export type ToolLinkRoute = (typeof TOOL_LINK_ROUTES)[number];

export const STEP_KINDS = [
  "image",
  "video",
  "motion",
  "lipsync",
  "text",
  "instruction",
] as const;
export type GuidedStepKind = (typeof STEP_KINDS)[number];

export const guidedPlaceholderSchema = z.object({
  /** Token that appears inside the prompt template as [KEY]. */
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  example: z.string().max(400).default(""),
});
export type GuidedPlaceholder = z.infer<typeof guidedPlaceholderSchema>;

export const guidedReferenceSlotSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  description: z.string().max(400).default(""),
  required: z.boolean().default(false),
});
export type GuidedReferenceSlot = z.infer<typeof guidedReferenceSlotSchema>;

export const guidedStepSchema = z.object({
  id: z.string().min(1).max(60),
  title: z.string().min(1).max(140),
  kind: z.enum(STEP_KINDS),
  description: z.string().max(2000).default(""),
  /** Prompt with [PLACEHOLDER] tokens. Empty for pure instruction steps. */
  promptTemplate: z.string().max(4000).default(""),
  placeholders: z.array(guidedPlaceholderSchema).max(12).default([]),
  referenceSlots: z.array(guidedReferenceSlotSchema).max(6).default([]),
  /** Offer the previous generative step's result as a reference input. */
  usesPreviousResult: z.boolean().default(false),
  tips: z.array(z.string().max(600)).max(8).default([]),
  toolLink: z
    .object({
      label: z.string().min(1).max(80),
      to: z.enum(TOOL_LINK_ROUTES),
    })
    .nullish(),
  /** Optional alternate prompts (e.g. extra camera angles, scene variants). */
  variants: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        prompt: z.string().min(1).max(4000),
      }),
    )
    .max(10)
    .default([]),
});
export type GuidedStep = z.infer<typeof guidedStepSchema>;

export const WORKFLOW_CATEGORIES = [
  "performance",
  "music-video",
  "character",
  "realism",
  "effects",
  "product",
] as const;
export type GuidedWorkflowCategory = (typeof WORKFLOW_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<GuidedWorkflowCategory, string> = {
  performance: "Performance",
  "music-video": "Music Video",
  character: "AI Artist",
  realism: "Realism",
  effects: "Effects",
  product: "Product & E-commerce",
};

export const guidedWorkflowContentSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, dashes"),
  title: z.string().min(2).max(140),
  tagline: z.string().max(200).default(""),
  description: z.string().max(3000).default(""),
  category: z.enum(WORKFLOW_CATEGORIES),
  icon: z.string().max(16).default("🎬"),
  sourceCredit: z.string().max(140).default(""),
  steps: z.array(guidedStepSchema).min(1).max(20),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export type GuidedWorkflowContent = z.infer<typeof guidedWorkflowContentSchema>;

/** Row shape as returned by the server functions (content + db metadata). */
export type GuidedWorkflowRow = GuidedWorkflowContent & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

/** Fill `[KEY]` tokens with user-provided values; unfilled tokens remain
 * visible so the user can spot what still needs replacing. */
export function fillPromptTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\[([A-Z0-9_ /—-]+)\]/g, (match, rawKey: string) => {
    const key = rawKey.trim();
    const v = values[key];
    return v && v.trim().length > 0 ? v.trim() : match;
  });
}

/** Extract the distinct [TOKEN] keys present in a template (render order). */
export function extractPlaceholderKeys(template: string): string[] {
  const keys: string[] = [];
  for (const m of template.matchAll(/\[([A-Z0-9_ /—-]+)\]/g)) {
    const key = m[1].trim();
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}

/** Which step kinds actually generate media inside the runner. */
export function isRunnableKind(kind: GuidedStepKind): boolean {
  return kind === "image" || kind === "video";
}

export const STEP_KIND_LABELS: Record<GuidedStepKind, string> = {
  image: "Generate image",
  video: "Animate (image → video)",
  motion: "Motion Control",
  lipsync: "Lip Sync",
  text: "Prompt / planning",
  instruction: "Do it yourself",
};
