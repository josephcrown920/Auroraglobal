import { describe, expect, test } from "bun:test";
import { auditMarketingCampaignClaims, type ClaimAuditCampaign } from "./social-studio.claims";

function campaign(overrides: Partial<ClaimAuditCampaign["items"][number]> = {}): ClaimAuditCampaign {
  return {
    name: "Direct the shot",
    strategy: "Show the Video Agent turning a written brief into a multi-shot production, one scene at a time.",
    items: [
      {
        title: "Brief in, film out",
        format: "reel",
        hook: "You describe the shot. Aurora directs it.",
        caption: "Type the brief, watch the shots come together, keep the takes you love. Made with Aurora Video Agent.",
        cta: "Open Video Agent",
        hashtags: ["aurora", "musicvideo", "aiproduction"],
        slides: [],
        ...overrides,
      },
    ],
  };
}

describe("auditMarketingCampaignClaims", () => {
  test("passes clean, catalog-faithful copy", () => {
    expect(auditMarketingCampaignClaims(campaign())).toEqual([]);
  });

  test("audits the item title too — it ships in cards and manifests", () => {
    const issues = auditMarketingCampaignClaims(campaign({ title: "Better than Runway, free forever" }));
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.every((issue) => issue.includes("title"))).toBe(true);
  });

  test("flags third-party product names anywhere in the copy", () => {
    const issues = auditMarketingCampaignClaims(campaign({ caption: "Better than Runway and Pika Labs combined." }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/third-party product: "Runway"/);
  });

  test("flags invented metrics and social proof", () => {
    expect(auditMarketingCampaignClaims(campaign({ hook: "10x faster than shooting on set" }))).toHaveLength(1);
    expect(auditMarketingCampaignClaims(campaign({ caption: "Trusted by 2 million creators" }))).toHaveLength(1);
    expect(auditMarketingCampaignClaims(campaign({ cta: "Join the world's best AI studio" }))).toHaveLength(1);
  });

  test("does not flag benign numbers such as durations or resolutions", () => {
    expect(auditMarketingCampaignClaims(campaign({ caption: "A 5 second reel from one 1080 x 1920 frame." }))).toEqual([]);
  });

  test("flags unapproved promises and hashtags", () => {
    expect(auditMarketingCampaignClaims(campaign({ caption: "Unlimited renders, free forever." }))).toHaveLength(1);
    expect(auditMarketingCampaignClaims(campaign({ hashtags: ["aurora", "midjourney"] }))).toHaveLength(1);
  });

  test("audits carousel slides too", () => {
    const issues = auditMarketingCampaignClaims(
      campaign({ format: "carousel", slides: [{ heading: "Step 1", body: "Integrates with Premiere for export." }] }),
    );
    expect(issues.some((issue) => /slide 1/.test(issue))).toBe(true);
  });

  test("rejects formats that were not in the brief", () => {
    const issues = auditMarketingCampaignClaims(campaign({ format: "story" }), {
      allowedFormats: new Set(["feed", "reel"]),
    });
    expect(issues).toEqual([expect.stringContaining('uses format "story"')]);
  });
});
