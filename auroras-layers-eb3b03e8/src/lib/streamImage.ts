import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type Frame = (dataUrl: string, isFinal: boolean) => void;

function toDataUrl(b64: string) {
  return b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
}

function extractB64(payload: unknown): string | null {
  const p = payload as any;
  if (!p) return null;
  return (
    p.b64_json ??
    p.image?.b64_json ??
    p.data?.[0]?.b64_json ??
    p.partial_image_b64 ??
    p.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
    null
  );
}


/**
 * POSTs a prompt (plus optional source image) to a streaming image route and
 * emits every partial frame, then the final image.
 */
export async function streamImage(
  endpoint: string,
  body: { prompt: string; imageDataUrl?: string; characterReferenceDataUrl?: string; model?: string },
  onFrame: Frame,
): Promise<void> {

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Image request failed (${res.status})`);
  }

  let events = 0;
  let completed = false;
  let streamError: string | null = null;
  const parser = createParser({
    onEvent(event) {
      if (!event.data || event.data === "[DONE]") return;
      try {
        const parsed = JSON.parse(event.data) as Record<string, unknown>;
        if (event.event === "error" || parsed["type"] === "error") {
          events++;
          const detail = parsed["error"] as { message?: string } | undefined;
          streamError = detail?.message ?? "Image generation failed";
          return;
        }
        const b64 = extractB64(parsed);
        if (!b64) return;
        events++;
        const type = String(parsed["type"] ?? event.event ?? "");
        const final = type.includes("completed");
        flushSync(() => onFrame(toDataUrl(b64), final));
        if (final) completed = true;
      } catch {
        // Ignore provider keepalives and non-JSON frames.
      }
    },
  });
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }

  if (streamError) throw new Error(streamError);
  if (events > 0 && completed) return;
  if (events > 0) throw new Error("Image stream ended before the final frame arrived");

  // Zero-event stream: replay once without streaming.
  const fallback = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: false }),
  });
  if (!fallback.ok) {
    throw new Error((await fallback.text().catch(() => "")) || "Image generation failed");
  }
  const json = await fallback.json();
  const b64 = extractB64(json);
  if (!b64) throw new Error("No image returned");
  onFrame(toDataUrl(b64), true);
}
