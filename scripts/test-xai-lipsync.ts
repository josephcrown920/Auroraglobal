import { runLipsyncJob } from "../src/lib/lipsync.server";

const domain = process.env.REPLIT_DEV_DOMAIN;
if (!domain) throw new Error("REPLIT_DEV_DOMAIN not set");

const userId = process.argv[2];
if (!userId) throw new Error("usage: bun run scripts/test-xai-lipsync.ts <admin-user-id>");

const imageUrl = `https://${domain}/josh/josh-pink-mic-portrait.jpg`;
const audioUrl = `https://${domain}/audio/the-one-hook2-clip.mp3`;

console.log("imageUrl:", imageUrl);
console.log("audioUrl:", audioUrl);

const result = await runLipsyncJob({
  userId,
  videoUrl: imageUrl,
  audioUrl,
  engine: "xai-ugc",
  imageUrl,
});

console.log("RESULT:", JSON.stringify(result, null, 2));
