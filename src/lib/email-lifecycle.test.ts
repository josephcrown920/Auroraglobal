import { describe, expect, it } from "bun:test";
import {
  firstGenerationDedupeKey,
  hasOnboardingCompletion,
  lifecycleDedupeKey,
  safeEmailImageUrl,
  shouldSendFirstPurchaseNudge,
  shouldSendReEngagement,
} from "./email-lifecycle";

describe("email lifecycle guards", () => {
  it("uses one stable claim key for first-generation delivery", () => {
    expect(firstGenerationDedupeKey("user-1")).toBe("first_generation_complete:user-1");
    expect(firstGenerationDedupeKey("user-1")).toBe(firstGenerationDedupeKey("user-1"));
  });

  it("dedupes one-time onboarding and purchase templates only", () => {
    expect(lifecycleDedupeKey("onboarding_done", "user-1")).toBe("onboarding_done:user-1");
    expect(lifecycleDedupeKey("first_purchase_nudge", "user-1")).toBe("first_purchase_nudge:user-1");
    expect(lifecycleDedupeKey("daily_tip", "user-1")).toBeUndefined();
  });

  it("recognizes the canonical onboarding completion event", () => {
    expect(hasOnboardingCompletion(["onboarding_shown"])).toBe(false);
    expect(hasOnboardingCompletion(["onboarding_complete"])).toBe(true);
    expect(hasOnboardingCompletion(["onboarding_completed"])).toBe(true);
  });

  it("re-engages only users who have never generated and were not recently emailed", () => {
    expect(shouldSendReEngagement({ hasGenerated: false, recentlyEmailed: false })).toBe(true);
    expect(shouldSendReEngagement({ hasGenerated: true, recentlyEmailed: false })).toBe(false);
    expect(shouldSendReEngagement({ hasGenerated: false, recentlyEmailed: true })).toBe(false);
  });

  it("keeps first-purchase nudges away from purchasers and duplicate sends", () => {
    expect(shouldSendFirstPurchaseNudge({ lifetimeCreditsPurchased: 0, alreadySent: false })).toBe(true);
    expect(shouldSendFirstPurchaseNudge({ lifetimeCreditsPurchased: 10, alreadySent: false })).toBe(false);
    expect(shouldSendFirstPurchaseNudge({ lifetimeCreditsPurchased: 0, alreadySent: true })).toBe(false);
  });

  it("accepts only bounded HTTPS result URLs for email images", () => {
    expect(safeEmailImageUrl("https://cdn.example.com/result.png")).toBe("https://cdn.example.com/result.png");
    expect(safeEmailImageUrl("javascript:alert(1)")).toBeNull();
    expect(safeEmailImageUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });
});