import { orchestrate } from "../src/lib/orchestrator.server";

async function main() {
  const userId = process.argv[2];
  if (!userId) throw new Error("usage: bun run scripts/test-heygen-direct.ts <userId>");
  const domain = process.env.REPLIT_DEV_DOMAIN;
  const videoUrl = `https://${domain}/videos/user-reference.mp4`;
  const audioUrl = `https://${domain}/audio/the-one-hook2-clip.mp3`;
  console.log("videoUrl:", videoUrl);
  console.log("audioUrl:", audioUrl);
  const result = await orchestrate({
    kind: "lipsync",
    model: "heygen/lipsync",
    pinnedModelOnly: true,
    videoUrl,
    audioUrl,
    userId,
    refId: "00000000-0000-4000-8000-000000000002",
  } as any);
  console.log("RESULT:", JSON.stringify(result));
}

main().catch((e) => {
  console.error("ERROR:", e?.message || e);
  process.exit(1);
});
