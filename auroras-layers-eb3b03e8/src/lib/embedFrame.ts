/** Host <-> iframe messaging contract for Aurora Layers. */
export const EMBED_SOURCE = "aurora-layers";

export type EmbedOutboundMessage =
  | { source: typeof EMBED_SOURCE; type: "ready" }
  | { source: typeof EMBED_SOURCE; type: "height"; height: number }
  | { source: typeof EMBED_SOURCE; type: "auth"; status: "authenticated" | "error" };

export type EmbedInboundMessage =
  | { source: typeof EMBED_SOURCE; type: "sso"; token: string };

/**
 * Aurora's host widget appends its own origin to the iframe URL. This keeps
 * postMessage traffic scoped to the actual host instead of broadcasting it.
 */
export function getEmbedHostOrigin(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("hostOrigin");
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function post(message: EmbedOutboundMessage) {
  if (typeof window === "undefined" || window.parent === window) return;
  // Height and readiness messages are non-sensitive. The fallback preserves
  // backwards compatibility for hand-authored embeds; Aurora's widget always
  // supplies a specific target origin.
  window.parent.postMessage(message, getEmbedHostOrigin() ?? "*");
}

export function postReady() {
  post({ source: EMBED_SOURCE, type: "ready" });
}

export function postAuth(status: "authenticated" | "error") {
  post({ source: EMBED_SOURCE, type: "auth", status });
}

/**
 * Measures the real content height and streams it to the host on every change:
 * DOM mutations, image loads, font swaps, viewport resizes and animation frames
 * right after mount. Returns a cleanup function.
 */
export function startHeightReporting(): () => void {
  if (typeof window === "undefined") return () => {};

  let last = 0;
  let frame = 0;

  const measure = () => {
    const body = document.body;
    const html = document.documentElement;
    const height = Math.ceil(
      Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.scrollHeight,
        html.offsetHeight,
        html.getBoundingClientRect().height,
      ),
    );
    if (height > 0 && Math.abs(height - last) > 1) {
      last = height;
      post({ source: EMBED_SOURCE, type: "height", height });
    }
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      measure();
    });
  };

  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(document.body);
  resizeObserver.observe(document.documentElement);

  const mutationObserver = new MutationObserver(schedule);
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden"],
  });

  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);
  document.addEventListener("transitionend", schedule);
  document.addEventListener("animationend", schedule);

  // Catch late layout shifts (fonts, images, streamed frames).
  const timers = [50, 200, 600, 1500, 3000].map((delay) =>
    window.setTimeout(schedule, delay),
  );
  const interval = window.setInterval(schedule, 1000);

  schedule();

  return () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("load", schedule);
    document.removeEventListener("transitionend", schedule);
    document.removeEventListener("animationend", schedule);
    timers.forEach((timer) => window.clearTimeout(timer));
    window.clearInterval(interval);
    if (frame) window.cancelAnimationFrame(frame);
  };
}

/**
 * Listens for an SSO token only from the exact host origin supplied in the
 * embed URL. Without hostOrigin, postMessage SSO is intentionally disabled.
 */
export function onHostSsoToken(handler: (token: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const expectedOrigin = getEmbedHostOrigin();
  if (!expectedOrigin) return () => {};

  const listener = (event: MessageEvent) => {
    if (event.origin !== expectedOrigin || event.source !== window.parent) return;
    const data = event.data as EmbedInboundMessage | undefined;
    if (
      data?.source === EMBED_SOURCE &&
      data.type === "sso" &&
      typeof data.token === "string" &&
      data.token.length > 0 &&
      data.token.length <= 8192
    ) {
      handler(data.token);
    }
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
