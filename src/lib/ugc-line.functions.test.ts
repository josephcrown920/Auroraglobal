import { describe, expect, it } from "bun:test";
import { generateSceneImagesFromRefCore } from "./ugc-line.functions";

// Pins the reference-URL ownership guard on the UGC scene-image path: a stored
// referenceUrl must belong to the caller, checked BEFORE any generation call.
// The core is deps-injected (gifts.functions.ts pattern) so no network or DB
// is touched here.

const OWNERSHIP_ERR = "You can only use character images you own.";
const STUDIO = "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/";

const baseInput = {
  referenceBase64: "aGVsbG8=",
  referenceMimeType: "image/jpeg",
  prompts: ["golden hour selfie"],
  aspectRatio: "4:5",
};

function fakeGemini(imageData: string): typeof fetch {
  return (async () =>
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ inline_data: { data: imageData } }] } }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as unknown as typeof fetch;
}

describe("generateSceneImagesFromRefCore — ownership guard", () => {
  it("rejects a foreign stored reference URL BEFORE any generation call", async () => {
    let fetches = 0;
    await expect(
      generateSceneImagesFromRefCore(
        "user-1",
        { ...baseInput, referenceUrl: `${STUDIO}other-user/face.jpg` },
        {
          assertOwned: async () => {
            throw new Error(OWNERSHIP_ERR);
          },
          apiKey: "test-gemini-key",
          fetchImpl: (async () => {
            fetches++;
            return new Response("{}", { status: 200 });
          }) as unknown as typeof fetch,
        },
      ),
    ).rejects.toThrow(/character images you own/);
    expect(fetches).toBe(0);
  });

  it("accepts an owned stored reference URL and generates", async () => {
    const seen: string[] = [];
    const ownedUrl = `${STUDIO}me/face.jpg`;
    const res = await generateSceneImagesFromRefCore(
      "user-1",
      { ...baseInput, referenceUrl: ownedUrl },
      {
        assertOwned: async (url) => {
          seen.push(url);
        },
        apiKey: "test-gemini-key",
        fetchImpl: fakeGemini("IMG_DATA"),
      },
    );
    expect(seen).toEqual([ownedUrl]);
    expect(res.results).toHaveLength(1);
    expect(res.results[0]).toEqual({
      prompt: "golden hour selfie",
      imageBase64: "IMG_DATA",
      error: null,
    });
  });

  it("skips the guard entirely when no stored URL is supplied (transient base64 only)", async () => {
    const seen: string[] = [];
    const res = await generateSceneImagesFromRefCore("user-1", baseInput, {
      assertOwned: async (url) => {
        seen.push(url);
      },
      apiKey: "test-gemini-key",
      fetchImpl: fakeGemini("IMG_DATA"),
    });
    expect(seen).toHaveLength(0);
    expect(res.results[0].imageBase64).toBe("IMG_DATA");
  });
});
