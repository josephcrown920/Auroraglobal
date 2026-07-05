import { orchestrate } from "./src/lib/orchestrator.server";
import { buildAnglePrompt, RESHOOT_ANGLES, RESHOOT_MODEL } from "./src/lib/reshoot-angles";

const REF_IMAGE = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80";

async function main() {
  const angle = RESHOOT_ANGLES[0]; // fisheye
  const prompt = buildAnglePrompt(angle, null);
  console.log("Testing angle:", angle.id, "model:", RESHOOT_MODEL);
  try {
    const res = await orchestrate({
      kind: "image",
      model: RESHOOT_MODEL,
      prompt,
      imageUrls: [REF_IMAGE],
      userId: "test-script-user",
      refId: "3f80a0b3-3ba8-4a64-a67c-144e8414a9c2",
    });
    console.log("SUCCESS:", JSON.stringify(res, null, 2).slice(0, 500));
  } catch (e) {
    console.error("FAILED:", e instanceof Error ? e.message : e);
  }
}

main();
