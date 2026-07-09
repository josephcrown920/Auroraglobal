import { orchestrate } from "../src/lib/orchestrator.server";

const domain = process.env.REPLIT_DEV_DOMAIN;
if (!domain) throw new Error("REPLIT_DEV_DOMAIN not set");

const userId = process.argv[2];
if (!userId) throw new Error("usage: bun run scripts/test-heygen-direct.ts <admin-user-id>");

const imageUrl = `https://${domain}/josh/josh-pink-mic-portrait.jpg`;
const audioUrl = `https://${domain}/audio/the-one-hook2-clip.mp3`;

console.log("imageUrl:", imageUrl);
console.log("audioUrl:", audioUrl);

try {
  const result = await orchestrate({
    kind: "lipsync",
    model: "heygen/lipsync",
    pinnedModelOnly: true,
    imageUrls: [imageUrl],
    audioUrl,
    userId,
    refId: "00000000-0000-4000-8000-000000000001",
  });
  console.log("RESULT:", JSON.stringify(result, null, 2));
} catch (e) {
  console.log("ERROR:", e instanceof Error ? e.message : e);
}
