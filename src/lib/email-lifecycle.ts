export type OneTimeLifecycleTemplate =
  | "signup_welcome"
  | "onboarding_done"
  | "first_purchase_nudge"
  | "onboarding_resume";

export function lifecycleDedupeKey(template: OneTimeLifecycleTemplate | string, userId: string): string | undefined {
  if (
    template === "signup_welcome" ||
    template === "onboarding_done" ||
    template === "first_purchase_nudge" ||
    template === "onboarding_resume"
  ) {
    return `${template}:${userId}`;
  }
  return undefined;
}

export function firstGenerationDedupeKey(userId: string): string {
  return `first_generation_complete:${userId}`;
}

export function hasOnboardingCompletion(eventNames: string[]): boolean {
  return eventNames.includes("onboarding_complete") || eventNames.includes("onboarding_completed");
}

export function shouldSendReEngagement(args: { hasGenerated: boolean; recentlyEmailed: boolean }): boolean {
  return !args.hasGenerated && !args.recentlyEmailed;
}

export function shouldSendFirstPurchaseNudge(args: {
  lifetimeCreditsPurchased: number;
  alreadySent: boolean;
}): boolean {
  return args.lifetimeCreditsPurchased === 0 && !args.alreadySent;
}

export function safeEmailImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}