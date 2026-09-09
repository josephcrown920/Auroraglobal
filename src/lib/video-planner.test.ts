import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { VideoPlanSchema, type VideoPlan } from "./video-agent-skills";
import { applyDeterministicPlanValidation, planCinematicVideo } from "./video-planner";

const savedSessionSecret = process.env.SESSION_SECRET;
beforeAll(() => {
  process.env.SESSION_SECRET = "planner-focused-test-secret";
});
afterAll(() => {
  if (savedSessionSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = savedSessionSecret;
});

const legacyPlan: VideoPlan = {
  brief: {
    title: "Night Run",
    logline: "A courier races home before dawn.",
    genre: "thriller",
    mood: "urgent",
    palette: [
      { hex: "#101820", role: "dominant" },
      { hex: "#FEE715", role: "accent" },
      { hex: "#000000", role: "shadow" },
    ],
    references: ["Michael Mann, Collateral (2004)", "Wong Kar-wai, Fallen Angels (1995)"],
    motion_language: "Kinetic Energy",
    format: "16:9",
  },
  shots: [
    {
      id: "shot-1",
      purpose: "establishing",
      shot_type: "WIDE",
      duration_s: 5,
      action: "The courier runs.",
      prompt: "WIDE, courier runs through a wet street at night",
      negative_prompt: "warped face, extra fingers",
    },
  ],
};

const completePlannerPlan = {
  ...legacyPlan,
  direction: {
    lens: "35mm",
    film_stock: "ARRI Alexa digital",
    lighting: "soft window key",
    camera_movement: "slow push",
    pacing: "measured" as const,
    sound_register: "naturalistic",
  },
  screenplay: {
    synopsis: "The courier runs through the night.",
    beats: [{ id: "beat-1", timing: "0–5s", visual: "Wet street", action: "The courier runs." }],
  },
  continuity_ledger: {
    identity: ["the courier"],
    wardrobe: ["yellow raincoat"],
    props: [],
    location: ["wet street"],
    time: ["night"],
    lighting: ["streetlights"],
    screen_direction: ["frame-left to frame-right"],
    audio: ["footsteps"],
  },
  shots: [{ ...legacyPlan.shots![0], screenplay_beat_id: "beat-1" }],
  render_plan: {
    model: "byteplus/seedance-2.5",
    aspect_ratio: "16:9",
    resolution: "720p" as const,
    fps: 24 as const,
  },
  warnings: [],
  stages: {
    brief: { status: "complete" as const, summary: "Brief complete" },
    script: { status: "complete" as const, summary: "Script complete" },
    continuity: { status: "complete" as const, summary: "Continuity complete" },
    shots: { status: "complete" as const, summary: "Shots complete" },
    render_plan: { status: "complete" as const, summary: "Render plan complete" },
  },
};

describe("cinematic planner contract", () => {
  it("keeps legacy VideoPlan payloads valid", () => {
    expect(VideoPlanSchema.parse(legacyPlan)).toEqual(legacyPlan);
  });

  it("accepts the rich screenplay, continuity, warning, and stage contract", () => {
    const rich = VideoPlanSchema.parse({
      ...legacyPlan,
      screenplay: {
        synopsis: "The courier loses and recovers a letter.",
        beats: [
          {
            id: "beat-1",
            timing: "0–5s",
            visual: "Rain crosses the streetlights.",
            action: "The courier pedals east.",
            audio: "Distant thunder and bicycle bell.",
          },
        ],
      },
      continuity_ledger: {
        identity: ["red-haired bicycle courier"],
        wardrobe: ["yellow raincoat"],
        props: ["handwritten letter", "bicycle"],
        location: ["rainy Singapore street"],
        time: ["before dawn"],
        lighting: ["cool streetlights"],
        screen_direction: ["courier travels frame-left to frame-right"],
        audio: ["distant thunder", "bicycle bell"],
      },
      warnings: [{ code: "continuity", message: "Keep the letter absent after shot three." }],
      stages: Object.fromEntries(
        ["brief", "script", "continuity", "shots", "render_plan"].map((stage) => [
          stage,
          { status: "complete", summary: `${stage} complete` },
        ]),
      ),
    });
    expect(rich.continuity_ledger?.wardrobe).toEqual(["yellow raincoat"]);
    expect(rich.stages?.render_plan.status).toBe("complete");
  });

  it("prefers DeepSeek, preserves fallbacks, and authors provenance server-side", async () => {
    let captured: Record<string, unknown> | undefined;
    const plan = await planCinematicVideo(
      { mode: "full", userIdea: "Keep the courier's tragic ending exactly.", format: "16:9" },
      "user-1",
      async (args) => {
        captured = args as unknown as Record<string, unknown>;
        return {
          output: { ...completePlannerPlan, provenance: { provider: "model-claim" } },
          provider: "deepseek",
          model: "deepseek/deepseek-v3.2",
          category: "VIDEO_DIRECTION",
          fallbackCount: 0,
          latencyMs: 42,
        } as never;
      },
    );

    expect(captured?.preferredProviders).toEqual(["deepseek"]);
    expect(String(captured?.prompt)).toContain("warn instead of silently rewriting");
    expect(plan.provenance).toMatchObject({
      provider: "deepseek",
      model: "deepseek/deepseek-v3.2",
      planning_mode: "full",
      schema_version: "2",
    });
    expect(plan.provenance?.provider).not.toBe("model-claim");
    expect(plan.receipt?.version).toBe("1");
    expect(plan.render_plan).toMatchObject({
      model: "byteplus/seedance-2.5",
      resolution: "720p",
    });
  });

  it("sends complete prior story context for bounded revisions", async () => {
    let prompt = "";
    await planCinematicVideo(
      { mode: "revision", revisionRequest: "Only make shot one longer.", previousPlan: legacyPlan },
      "user-1",
      async (args) => {
        prompt = args.prompt;
        return {
          output: completePlannerPlan,
          provider: "openai",
          model: "gpt-5.4-mini",
          category: "VIDEO_DIRECTION",
          fallbackCount: 1,
          latencyMs: 80,
        };
      },
    );
    expect(prompt).toContain("Only make shot one longer.");
    expect(prompt).toContain("A courier races home before dawn.");
    expect(prompt).toContain("Preserve every unaffected story fact");
  });

  it("rejects every missing required complete-plan stage instead of manufacturing it", async () => {
    for (const field of [
      "brief",
      "direction",
      "screenplay",
      "continuity_ledger",
      "shots",
      "render_plan",
      "warnings",
      "stages",
    ] as const) {
      const incomplete = { ...completePlannerPlan } as Record<string, unknown>;
      delete incomplete[field];
      await expect(
        planCinematicVideo(
          { mode: "full", userIdea: "Complete plan" },
          "user-1",
          async () =>
            ({
              output: incomplete,
              provider: "deepseek",
              model: "deepseek/deepseek-v3.2",
              category: "VIDEO_DIRECTION",
              fallbackCount: 0,
              latencyMs: 1,
            }) as never,
        ),
      ).rejects.toThrow();
    }
  });

  it("adds deterministic warnings without changing story content", () => {
    const input: VideoPlan = {
      ...legacyPlan,
      screenplay: {
        synopsis: "Original ending remains.",
        beats: [
          { id: "beat-1", timing: "0–5s", visual: "Street", action: "Runs" },
          { id: "beat-1", timing: "5–8s", visual: "Awning", action: "Stops" },
        ],
      },
      shots: [
        { ...legacyPlan.shots![0], id: "duplicate", chain_from: "duplicate", screenplay_beat_id: "missing" },
        { ...legacyPlan.shots![0], id: "duplicate", chain_from: "unknown" },
      ],
    };
    const checked = applyDeterministicPlanValidation(input);
    expect(checked.screenplay?.synopsis).toBe("Original ending remains.");
    expect(checked.warnings?.some((warning) => warning.message.includes("Duplicate shot id"))).toBe(true);
    expect(checked.warnings?.some((warning) => warning.message.includes("contains a cycle"))).toBe(true);
    expect(checked.warnings?.some((warning) => warning.message.includes("unknown shot"))).toBe(true);
    expect(checked.warnings?.some((warning) => warning.message.includes("unknown screenplay beat"))).toBe(true);
    expect(checked.warnings?.some((warning) => warning.message.includes("Duplicate screenplay beat"))).toBe(true);
  });
});