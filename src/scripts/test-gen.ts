/**
 * Cheap pipeline smoke test — run with: bun src/scripts/test-gen.ts
 *
 * Rules:
 *  - Always pin an explicit cheap/free model. Never let the orchestrator
 *    auto-select (it may land on seedance or other paid providers).
 *  - pollinations/flux  → free, keyless image
 *  - pollinations/openai → free, keyless text
 *  - fal-ai/wav2lip     → cheaper lipsync engine (vs sync-lipsync/v2 Studio)
 */

import { orchestrate } from "@/lib/orchestrator.server";

const TEST_SELFIE = "https://aurora-sparkle-charm.lovable.app/__l5e/assets-v1/24c6484d-42b7-4d6c-8d1d-aeeb71a19d30/josh-yellow-mic.jpg";
const TEST_AUDIO  = "https://aurora-sparkle-charm.lovable.app/__l5e/assets-v1/04b233f7-4417-4708-a70a-761de327deef/the-one-hook.mp3";

type Result = { surface: string; provider?: string; url?: string; text?: string; error?: string; ms: number };

async function run(surface: string, fn: () => Promise<Awaited<ReturnType<typeof orchestrate>>>): Promise<Result> {
  const t = Date.now();
  try {
    const r = await fn();
    return { surface, provider: r.provider, url: r.url?.slice(0, 80) || undefined, text: r.text?.slice(0, 80) || undefined, ms: Date.now() - t };
  } catch (e) {
    return { surface, error: e instanceof Error ? e.message.slice(0, 120) : String(e), ms: Date.now() - t };
  }
}

const results = await Promise.all([
  // Colors Studio — image gen
  run("colors/image", () => orchestrate({
    kind: "image",
    model: "pollinations/flux",
    prompt: "cinematic musician portrait, violet studio backdrop, soft key light",
  })),

  // Canvas — image node
  run("canvas/image-node", () => orchestrate({
    kind: "image",
    model: "pollinations/flux",
    prompt: "music video still, neon city rooftop, night, cinematic",
  })),

  // Canvas — text/prompt builder node
  run("canvas/text-node", () => orchestrate({
    kind: "text",
    model: "pollinations/openai",
    prompt: "Write a 1-sentence cinematic shot description for a music video.",
  })),

  // Lipsync — wav2lip (cheap engine)
  run("lipsync/wav2lip", () => orchestrate({
    kind: "lipsync",
    model: "fal-ai/wav2lip",
    videoUrl: TEST_SELFIE,
    audioUrl: TEST_AUDIO,
  })),

  // Motion control — staging step is an image gen with pose + identity refs
  run("motion/stage", () => orchestrate({
    kind: "image",
    model: "pollinations/flux",
    prompt: "cinematic portrait, powerful performance stance, violet studio light",
    imageUrls: [TEST_SELFIE],
  })),
]);

console.log("\n── Test results ─────────────────────────────────────");
for (const r of results) {
  const icon = r.error ? "✗" : "✓";
  const detail = r.error
    ? `ERROR: ${r.error}`
    : `${r.provider} · ${r.url ?? r.text ?? "(no output)"}`;
  console.log(`${icon} ${r.surface.padEnd(24)} ${r.ms}ms  ${detail}`);
}
const failed = results.filter((r) => r.error);
console.log(`\n${results.length - failed.length}/${results.length} passed\n`);
