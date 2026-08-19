import { describe, expect, it } from "bun:test";
import type { DirectorRoomImageDeps } from "./director-room-generate.server";
import {
  DIRECTOR_ROOM_IMAGE_MODEL,
  handleDirectorRoomImageRequest,
} from "./director-room-generate.server";

function request(body: unknown): Request {
  return new Request("https://example.test/api/directors-board/generate-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer valid-user-token",
    },
    body: JSON.stringify(body),
  });
}

function deps(overrides: Partial<DirectorRoomImageDeps> = {}) {
  const reserveCalls: unknown[] = [];
  const ownedChecks: string[] = [];
  const d: DirectorRoomImageDeps = {
    getUserId: async () => "user-1",
    assertOwnedReferenceImage: async (url) => {
      ownedChecks.push(url);
    },
    assertDailyBudget: async () => {},
    reserveOrchestrateRecord: async (input) => {
      reserveCalls.push(input);
      return {
        ok: true,
        generationId: "generation-1",
        url: "https://cdn.example/director-room.png",
        provider: DIRECTOR_ROOM_IMAGE_MODEL,
        endpoint: "replit-ai-integrations",
        latencyMs: 42,
        costUsd: 0.01,
      };
    },
    ...overrides,
  };
  return { d, reserveCalls, ownedChecks };
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("Director Room image endpoint", () => {
  it("returns 402 before provider dispatch when the canonical credit flow reports insufficient credits", async () => {
    const { d, reserveCalls } = deps({
      reserveOrchestrateRecord: async (input) => {
        reserveCalls.push(input);
        return { ok: false, error: "Insufficient credits", insufficient: true };
      },
    });

    const response = await handleDirectorRoomImageRequest(request({ prompt: "a rooftop shot" }), d);

    expect(response.status).toBe(402);
    expect(await body(response)).toMatchObject({ error: "Insufficient credits" });
    expect(reserveCalls).toHaveLength(1);
  });

  it("returns the generation record id from the reserve/record flow on success", async () => {
    const { d, reserveCalls } = deps();

    const response = await handleDirectorRoomImageRequest(
      request({ prompt: "  a rooftop shot  " }),
      d,
    );
    const result = await body(response);
    const input = reserveCalls[0] as {
      userId: string;
      kind: string;
      model: string;
      pinnedModelOnly?: boolean;
      prompt?: string;
      cost: number;
      reason: string;
    };

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      ok: true,
      generationId: "generation-1",
      url: "https://cdn.example/director-room.png",
      creditsCost: 10,
    });
    expect(input).toMatchObject({
      userId: "user-1",
      kind: "image",
      model: DIRECTOR_ROOM_IMAGE_MODEL,
      pinnedModelOnly: true,
      prompt: "a rooftop shot",
      cost: 10,
      reason: "director_room_image",
    });
  });

  it("rejects a foreign reference before reservation or provider dispatch", async () => {
    const { d, reserveCalls } = deps({
      assertOwnedReferenceImage: async () => {
        throw new Error("You can only use character images you own.");
      },
    });

    const response = await handleDirectorRoomImageRequest(
      request({
        prompt: "use this character",
        references: ["https://proj.supabase.co/storage/v1/object/public/studio/other-user/a.png"],
      }),
      d,
    );

    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({
      error: "You can only use character images you own.",
    });
    expect(reserveCalls).toHaveLength(0);
  });

  it("rejects an untrusted reference before reservation or provider dispatch", async () => {
    const { d, reserveCalls } = deps({
      assertOwnedReferenceImage: async () => {
        throw new Error("URL host not allowed");
      },
    });

    const response = await handleDirectorRoomImageRequest(
      request({ prompt: "use this character", references: ["https://evil.example/character.png"] }),
      d,
    );

    expect(response.status).toBe(400);
    expect(await body(response)).toMatchObject({ error: "URL host not allowed" });
    expect(reserveCalls).toHaveLength(0);
  });
});