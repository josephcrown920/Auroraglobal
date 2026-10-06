export const TEST_SELFIE_URL =
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1024&q=85";

export const TEST_AUDIO_URL =
  "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/smoke-test/test-audio-8s.mp3";

type FixtureFetch = (url: string, init: RequestInit) => Promise<Response>;

export async function preflightImageFixture(
  url: string,
  fetchFixture: FixtureFetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchFixture(url, {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Smoke preflight failed: selfie fixture is unreachable (${detail})`);
  }

  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(
      `Smoke preflight failed: selfie fixture returned HTTP ${response.status}; expected HTTP 200`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  await response.body?.cancel();
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new Error(
      `Smoke preflight failed: selfie fixture returned "${contentType || "no content type"}"; expected an image`,
    );
  }
}