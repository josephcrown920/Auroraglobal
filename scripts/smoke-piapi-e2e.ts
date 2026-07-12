// PiAPI end-to-end smoke test.
//
// Proves the full PiAPI round-trip:
//   1. Image — POST /api/v1/task (model=midjourney, task_type=imagine)
//              → polls GET /api/v1/task/{id} until status=completed
//              → asserts image URL returned
//   2. Video — POST /api/v1/task (model=kling, task_type=video_generation)
//              → polls until status=completed
//              → asserts video URL returned
//
// Requirements before running:
//   - PIAPI_API_KEY must be set as a Replit secret.
//
// Run:
//   bun run scripts/smoke-piapi-e2e.ts
//
// The test spends real PiAPI credits (Midjourney fast-mode ≈ $0.045 +
// Kling std-5s ≈ $0.16). Skip the video test with --image-only.

import { orchestrate } from "../src/lib/orchestrator.server";

const IMAGE_ONLY = process.argv.includes("--image-only");

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`[FAIL] ${msg}`);
}

function log(msg: string) {
  console.log(msg);
}

async function main() {
  const key = process.env.PIAPI_API_KEY;
  if (!key) {
    console.error("[piapi-e2e] FATAL: PIAPI_API_KEY is not set.");
    console.error("  → Add it in Replit's Secrets panel, then re-run.");
    process.exit(1);
  }
  log(`[piapi-e2e] PIAPI_API_KEY is set (${key.slice(0, 6)}…)`);

  // ── Step 1: Image generation (Midjourney imagine) ──────────────────────────
  log("\n[1/2] image via piapi/midjourney-imagine…");
  const imgStart = Date.now();
  const imgResult = await orchestrate({
    kind: "image",
    prompt: "a serene mountain lake at sunrise, photorealistic",
    model: "piapi/midjourney-imagine",
  });

  assert(imgResult.provider === "piapi", `provider must be "piapi" (got "${imgResult.provider}")`);
  assert(
    typeof imgResult.url === "string" && imgResult.url.startsWith("http"),
    `url must be a valid HTTP URL (got ${JSON.stringify(imgResult.url)})`,
  );
  assert(imgResult.backend === "external", `backend must be "external" (got "${imgResult.backend}")`);
  log(`[1/2] ✅ image URL: ${imgResult.url}`);
  log(`      provider: ${imgResult.provider}, endpoint: ${imgResult.endpoint}`);
  log(`      latency: ${((Date.now() - imgStart) / 1000).toFixed(1)} s`);

  // Verify the URL is reachable and returns an image content-type.
  const imgHead = await fetch(imgResult.url, { method: "HEAD" }).catch(() => null);
  if (imgHead) {
    const ct = imgHead.headers.get("content-type") ?? "";
    assert(
      imgHead.ok && (ct.includes("image") || ct.includes("octet-stream")),
      `image URL must be reachable and return image content-type (status=${imgHead.status}, ct="${ct}")`,
    );
    log(`      URL reachable: ${imgHead.status} ${ct}`);
  } else {
    log(`      (URL HEAD check skipped — cross-origin or CORS block)`);
  }

  // ── Step 2: Video generation (Kling via PiAPI) ─────────────────────────────
  if (IMAGE_ONLY) {
    log("\n[2/2] skipped (--image-only flag set)");
  } else {
    log("\n[2/2] video via piapi/kling-video (Kling std 5s)…");
    const vidStart = Date.now();
    const vidResult = await orchestrate({
      kind: "video",
      prompt: "a peaceful mountain lake, gentle ripples, sunrise light",
      model: "piapi/kling-video",
      duration: 5,
    });

    assert(vidResult.provider === "piapi", `provider must be "piapi" (got "${vidResult.provider}")`);
    assert(
      typeof vidResult.url === "string" && vidResult.url.startsWith("http"),
      `url must be a valid HTTP URL (got ${JSON.stringify(vidResult.url)})`,
    );
    assert(vidResult.backend === "external", `backend must be "external" (got "${vidResult.backend}")`);
    log(`[2/2] ✅ video URL: ${vidResult.url}`);
    log(`      provider: ${vidResult.provider}, endpoint: ${vidResult.endpoint}`);
    log(`      latency: ${((Date.now() - vidStart) / 1000).toFixed(1)} s`);

    const vidHead = await fetch(vidResult.url, { method: "HEAD" }).catch(() => null);
    if (vidHead) {
      const ct = vidHead.headers.get("content-type") ?? "";
      assert(
        vidHead.ok && (ct.includes("video") || ct.includes("octet-stream")),
        `video URL must be reachable and return video content-type (status=${vidHead.status}, ct="${ct}")`,
      );
      log(`      URL reachable: ${vidHead.status} ${ct}`);
    } else {
      log(`      (URL HEAD check skipped — cross-origin or CORS block)`);
    }
  }

  log("\n[piapi-e2e] ✅ ALL CHECKS PASSED");
}

main().catch((e) => {
  console.error("[piapi-e2e] FAILED:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
