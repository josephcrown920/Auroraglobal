/**
 * Cheap pipeline smoke test — run with: bun src/scripts/test-gen.ts
 *
 * Rules:
 *  - Always pin an explicit cheap/free model. Never let the orchestrator
 *    auto-select (it may land on seedance or other paid providers).
 *  - pollinations/flux  → free, keyless image
 *  - pollinations/openai → free, keyless text
 *  - sync/lipsync-2     → lipsync via Sync.so (Fal.ai exhausted, HeyGen endpoint stale)
 */

import { orchestrate } from "@/lib/orchestrator.server";

const TEST_SELFIE = "https://aurora-sparkle-charm.lovable.app/__l5e/assets-v1/24c6484d-42b7-4d6c-8d1d-aeeb71a19d30/josh-yellow-mic.jpg";
const TEST_AUDIO  = "https://aurora-sparkle-charm.lovable.app/__l5e/assets-v1/04b233f7-4417-4708-a70a-761de327deef/the-one-hook.mp3";
// Sync.so-accessible video + short audio (audio must be <20s on free plan)
const TEST_VIDEO  = "https://www.learningcontainer.com/wp-content/uploads/2020/05/sample-mp4-file.mp4";
const TEST_AUDIO_SHORT = "https://file-examples.com/storage/fe06b0eed66f3ab95f3a6f4/2017/11/file_example_MP3_700KB.mp3";

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

  // Lipsync — Sync.so connection check (201=connected, REJECTED=no face in sample video — expected)
  // Real lipsync tested via app UI (Lip Sync Studio) with an actual talking-head clip.
  run("lipsync/sync", () => orchestrate({
    kind: "lipsync",
    model: "sync/lipsync-2",
    videoUrl: TEST_VIDEO,
    audioUrl: TEST_AUDIO_SHORT,
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
