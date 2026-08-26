export type SafeFetchResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function safeFetch<T = unknown>(input: RequestInfo, init?: RequestInit, timeoutMs = 10_000): Promise<SafeFetchResult<T>> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(input, { signal: controller.signal, ...(init ?? {}) });
    clearTimeout(id);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `HTTP ${res.status} ${res.statusText} ${text}` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await res.json().catch(() => null);
      return { ok: true, data: json as T };
    }
    const text = await res.text().catch(() => "");
    return { ok: true, data: (text as unknown) as T };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: (err && (err as any).message) || String(err) };
  }
}
