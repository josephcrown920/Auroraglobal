import { describe, expect, test } from "bun:test";
import { preflightImageFixture } from "./smoke-fixtures.server";

const fixtureUrl = "https://example.com/selfie.jpg";

describe("preflightImageFixture", () => {
  test("accepts an HTTP 200 image response", async () => {
    await expect(
      preflightImageFixture(
        fixtureUrl,
        async () => new Response("image bytes", { status: 200, headers: { "content-type": "image/jpeg" } }),
      ),
    ).resolves.toBeUndefined();
  });

  test("rejects a non-200 response with a clear status message", async () => {
    await expect(
      preflightImageFixture(fixtureUrl, async () => new Response(null, { status: 404 })),
    ).rejects.toThrow("selfie fixture returned HTTP 404; expected HTTP 200");
  });

  test("rejects a network failure as unreachable", async () => {
    await expect(
      preflightImageFixture(fixtureUrl, async () => {
        throw new Error("connection refused");
      }),
    ).rejects.toThrow("selfie fixture is unreachable (connection refused)");
  });

  test("rejects a non-image response", async () => {
    await expect(
      preflightImageFixture(
        fixtureUrl,
        async () => new Response("not an image", { status: 200, headers: { "content-type": "text/html" } }),
      ),
    ).rejects.toThrow('selfie fixture returned "text/html"; expected an image');
  });
});