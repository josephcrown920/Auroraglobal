export type SafeFetchResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function safeFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 10_000,
): Promise<SafeFetchResult<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...(init ?? {}),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const suffix = text ? ` ${text}` : "";
      return {
        ok: false,
        error: `HTTP ${response.status} ${response.statusText}${suffix}`,
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await response.json().catch(() => null);
      return { ok: true, data: json as T };
    }

    const text = await response.text().catch(() => "");
    return { ok: true, data: text as T };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }

    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}
