import { describe, expect, it, mock } from "bun:test";
import type { RenderDeps } from "./generate-core.server";
import type { PlatformTemplate } from "./platform-templates";

// ── Module stubs ──────────────────────────────────────────────────────────────
// Same stubs (same shapes) as generate-core.server.test.ts — see
// bun-mock-module-leakage.md: identical stubs across suites are safe; the point
// is to never stub a module another suite needs REAL.
//
// result-store.server: reserveOrchestrateRecord calls persistResultUrl on every
// happy path — without this stub success tests would attempt a live re-host.
mock.module("./result-store.server", () => ({
  persistResultUrl: async (args: { url: string }) => ({
    url: args.url,
    persisted: false,
    compressed: false,
  }),
  resultMediaTypeForKind: (kind: string) => {
    if (
      ["video", "lipsync", "lyric_video", "assemble", "caption_burn"].includes(kind)
    )
      return "video";
    if (kind === "audio") return "audio";
    return "image";
  },
}));

// hf.server: imported at module scope by platform-template.functions.ts (and
// transitively via orchestrator.server) — stub so the import chain never needs
// real HF credentials. Tests inject their own `tts` dep; this stub is only for
// import safety and must never actually run.
mock.module("./hf.server", () => ({
  hfTextToSpeech: async () => {
    throw new Error("test must inject tts — real hfTextToSpeech stub reached");
  },
  hfTextToImage: async () => ({ bytes: new Uint8Array(), contentType: "image/png" }),
}));

const { reserveOrchestrateRecord } = await import("./generate-core.server");
const {
  _generateFromPlatformTemplateCore,
  PLATFORM_PHOTO_COST,
  PLATFORM_VIDEO_COST,
  PLATFORM_PHOTO_MODEL,
  PLATFORM_VIDEO_MODEL,
} = await import("./platform-template.functions");
type PlatformTemplateDeps =
  import("./platform-template.functions").PlatformTemplateDeps;

// ── Fixtures ──────────────────────────────────────────────────────────────────
// The photo template mirrors the real catalog entry ("street-floor"); the video
// template is synthetic because the live catalog currently ships no video-kind
// template — the branch is still production code and must keep the contract.

const PHOTO_TEMPLATE: PlatformTemplate = {
  id: "test-photo",
  kind: "photo",
  name: "Test Photo",
  description: "test",
  thumbnailPath: "/videos/thumbs/test.jpg",
  storagePath: "platform-templates/test-photo.png",
};

const VIDEO_TEMPLATE: PlatformTemplate = {
  id: "test-video",
  kind: "video",
  name: "Test Video",
  description: "test",
  thumbnailPath: "/videos/thumbs/test.jpg",
  storagePath: "platform-templates/test-video.mp4",
};

const SCRIPT = "Welcome to Aurora — let's make something unreal today.";
const AUDIO_URL = "https://signed.example/studio/audio/tts-1.mp3";

type RpcCall = { name: string; args: Record<string, unknown> };

/**
 * Test harness for the two-phase flow.
 *
 * The `reserve` dep is the REAL reserveOrchestrateRecord wired to injectable
 * RenderDeps (logged RPCs + controllable orchestrate) — so these tests prove the
 * template flow's credit behavior through the actual credit layer, not a mirror.
 *
 * `events` records coarse phase ordering: "sign" / "tts" / "upload" / "rpc:<name>".
 */
function makeHarness(overrides: {
  template: PlatformTemplate;
  ttsError?: string;
  uploadError?: string;
  orchestrateError?: string;
  insufficient?: boolean;
}) {
  const events: string[] = [];
  const rpcCalls: RpcCall[] = [];

  const renderDeps: RenderDeps = {
    rpc: async (name, args) => {
      events.push(`rpc:${name}`);
      rpcCalls.push({ name, args });
      if (name === "reserve_credits")
        return { data: !overrides.insufficient, error: null };
      if (name === "finalize_sync_render") return { data: "gen_tpl_1", error: null };
      return { data: null, error: null };
    },
    orchestrate: async (req) => {
      if (overrides.orchestrateError) throw new Error(overrides.orchestrateError);
      lastOrchestrateReq = req;
      return {
        url: "https://cdn.example/lipsync-out.mp4",
        provider: "heygen",
        endpoint: "heygen/photo-video",
        latencyMs: 5000,
        costUsd: 0.3,
      };
    },
  };
  let lastOrchestrateReq: Parameters<RenderDeps["orchestrate"]>[0] | undefined;

  const deps: PlatformTemplateDeps = {
    findTemplate: (id) => (id === overrides.template.id ? overrides.template : undefined),
    signAsset: async (path) => {
      events.push("sign");
      return `https://signed.example/studio/${path}`;
    },
    tts: async () => {
      events.push("tts");
      if (overrides.ttsError) throw new Error(overrides.ttsError);
      return { bytes: new ArrayBuffer(16), contentType: "audio/flac" };
    },
    uploadAudio: async () => {
      events.push("upload");
      if (overrides.uploadError) throw new Error(overrides.uploadError);
      return AUDIO_URL;
    },
    reserve: (input) => reserveOrchestrateRecord(input, renderDeps),
  };

  return {
    deps,
    events,
    rpcCalls,
    getLastOrchestrateReq: () => lastOrchestrateReq,
  };
}

function run(
  h: ReturnType<typeof makeHarness>,
  template: PlatformTemplate,
) {
  return _generateFromPlatformTemplateCore(
    "user_1",
    { templateId: template.id, script: SCRIPT },
    h.deps,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase-1/2 failures must never touch credits.
//
// Credits are only reserved in phase 3 (reserveOrchestrateRecord). A future
// change that moves the reserve call before TTS/upload would leak a reservation
// on every synthesis failure — these tests pin the contract.
// ─────────────────────────────────────────────────────────────────────────────

describe("two-phase credit contract: failures before the render never charge", () => {
  for (const template of [PHOTO_TEMPLATE, VIDEO_TEMPLATE]) {
    it(`${template.kind}: TTS failure → zero credit RPCs (reserve never called)`, async () => {
      const h = makeHarness({ template, ttsError: "HF 402: monthly inference credits exhausted" });

      await expect(run(h, template)).rejects.toThrow("HF 402");

      expect(h.rpcCalls).toHaveLength(0);
      // Upload must not run either — the flow stops at the failed phase.
      expect(h.events).not.toContain("upload");
      expect(h.events.filter((e) => e.startsWith("rpc:"))).toHaveLength(0);
    });

    it(`${template.kind}: audio upload failure → zero credit RPCs`, async () => {
      const h = makeHarness({ template, uploadError: "audio upload failed: bucket unavailable" });

      await expect(run(h, template)).rejects.toThrow("audio upload failed");

      expect(h.rpcCalls).toHaveLength(0);
      expect(h.events).toContain("tts"); // phase 1 ran…
      expect(h.events.filter((e) => e.startsWith("rpc:"))).toHaveLength(0); // …credits never touched
    });
  }

  it("unknown template → throws before any phase runs", async () => {
    const h = makeHarness({ template: PHOTO_TEMPLATE });
    await expect(
      _generateFromPlatformTemplateCore(
        "user_1",
        { templateId: "does-not-exist", script: SCRIPT },
        h.deps,
      ),
    ).rejects.toThrow("Unknown template");
    expect(h.events).toHaveLength(0);
    expect(h.rpcCalls).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase-3 outcomes through the REAL credit layer.
// ─────────────────────────────────────────────────────────────────────────────

describe("two-phase credit contract: the render phase reserves exactly once", () => {
  it("video template success → exactly reserve + finalize (commit), no release", async () => {
    const h = makeHarness({ template: VIDEO_TEMPLATE });

    const result = await run(h, VIDEO_TEMPLATE);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.generationId).toBe("gen_tpl_1");
      expect(result.url).toBe("https://cdn.example/lipsync-out.mp4");
    }
    expect(h.rpcCalls.map((c) => c.name)).toEqual([
      "reserve_credits",
      "finalize_sync_render",
    ]);
    // Phases ran in order, credits only after both prep phases.
    expect(h.events).toEqual(["sign", "tts", "upload", "rpc:reserve_credits", "rpc:finalize_sync_render"]);

    // The reservation carries the video-template cost, and the synthesized
    // audio + signed template asset actually reach the provider request.
    const reserve = h.rpcCalls.find((c) => c.name === "reserve_credits");
    expect(reserve?.args._amount).toBe(PLATFORM_VIDEO_COST);
    expect(reserve?.args._reason).toBe("platform_template_video");
    const req = h.getLastOrchestrateReq();
    expect(req?.model).toBe(PLATFORM_VIDEO_MODEL);
    expect(req?.pinnedModelOnly).toBe(true);
    expect(req?.audioUrl).toBe(AUDIO_URL);
    expect(req?.videoUrl).toBe(
      `https://signed.example/studio/${VIDEO_TEMPLATE.storagePath}`,
    );
  });

  it("photo template success → exactly reserve + finalize, asset routed as imageUrls", async () => {
    const h = makeHarness({ template: PHOTO_TEMPLATE });

    const result = await run(h, PHOTO_TEMPLATE);

    expect(result.ok).toBe(true);
    expect(h.rpcCalls.map((c) => c.name)).toEqual([
      "reserve_credits",
      "finalize_sync_render",
    ]);
    const reserve = h.rpcCalls.find((c) => c.name === "reserve_credits");
    expect(reserve?.args._amount).toBe(PLATFORM_PHOTO_COST);
    expect(reserve?.args._reason).toBe("platform_template_photo");
    const req = h.getLastOrchestrateReq();
    expect(req?.model).toBe(PLATFORM_PHOTO_MODEL);
    expect(req?.imageUrls).toEqual([
      `https://signed.example/studio/${PHOTO_TEMPLATE.storagePath}`,
    ]);
    expect(req?.audioUrl).toBe(AUDIO_URL);
  });

  it("lipsync render failure → exactly reserve + release, no finalize, no double-refund", async () => {
    const h = makeHarness({
      template: VIDEO_TEMPLATE,
      orchestrateError: "sync.so: lipsync inference failed",
    });

    await expect(run(h, VIDEO_TEMPLATE)).rejects.toThrow("lipsync inference failed");

    const names = h.rpcCalls.map((c) => c.name);
    expect(names).toEqual(["reserve_credits", "release_reservation"]);
    expect(names.filter((n) => n === "release_reservation")).toHaveLength(1);
    expect(names.filter((n) => n === "finalize_sync_render")).toHaveLength(0);
    // The release refunds exactly what was reserved.
    const release = h.rpcCalls.find((c) => c.name === "release_reservation");
    expect(release?.args._amount).toBe(PLATFORM_VIDEO_COST);
    expect(release?.args._reason).toBe("release_platform_template_video");
  });

  it("insufficient credits → ok:false, only reserve_credits fired, prep phases already ran", async () => {
    const h = makeHarness({ template: PHOTO_TEMPLATE, insufficient: true });

    const result = await run(h, PHOTO_TEMPLATE);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.insufficient).toBe(true);
    expect(h.rpcCalls.map((c) => c.name)).toEqual(["reserve_credits"]);
  });
});
