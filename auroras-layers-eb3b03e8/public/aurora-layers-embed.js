/* Aurora Layers drop-in iframe widget. */
(() => {
  "use strict";

  const SOURCE = "aurora-layers";
  const DEFAULT_HEIGHT = 1400;
  const MAX_HEIGHT = 200000;

  function numeric(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : fallback;
  }

  function buildEmbedUrl(source) {
    const url = new URL(source, window.location.href);
    url.searchParams.set("hostOrigin", window.location.origin);
    return url;
  }

  function mount(container) {
    if (container.dataset.auroraLayersMounted === "true") return;

    const source = container.dataset.src || container.getAttribute("data-aurora-layers");

    if (!source) {
      console.error(
        'Aurora Layers: add data-src="https://<layers-domain>/embed" to the embed container.',
      );
      return;
    }

    let embedUrl;
    try {
      embedUrl = buildEmbedUrl(source);
    } catch {
      console.error("Aurora Layers: data-src must be a valid absolute embed URL.");
      return;
    }

    const token = container.dataset.ssoToken;
    const initialHeight = numeric(container.dataset.height, DEFAULT_HEIGHT);
    const minimumHeight = numeric(container.dataset.minHeight, 360);
    const title = container.dataset.title || "Aurora Layers Studio";
    const frame = document.createElement("iframe");
    const frameOrigin = embedUrl.origin;
    let tokenSent = false;

    frame.src = embedUrl.toString();
    frame.title = title;
    frame.loading = "lazy";
    frame.allow = "clipboard-write; camera";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.setAttribute("allowfullscreen", "");
    frame.style.cssText = [
      "display:block",
      "width:100%",
      `height:${Math.max(initialHeight, minimumHeight)}px`,
      "border:0",
      "border-radius:24px",
      "background:#0b0614",
      "overflow:hidden",
    ].join(";");

    const postToken = () => {
      if (!token || tokenSent || !frame.contentWindow) return;
      frame.contentWindow.postMessage({ source: SOURCE, type: "sso", token }, frameOrigin);
      tokenSent = true;
    };

    const onMessage = (event) => {
      if (event.origin !== frameOrigin || event.source !== frame.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== SOURCE || typeof data.type !== "string") return;

      if (data.type === "ready") {
        container.setAttribute("aria-busy", "false");
        postToken();
      }

      if (
        data.type === "height" &&
        typeof data.height === "number" &&
        Number.isFinite(data.height)
      ) {
        const height = Math.min(Math.max(Math.ceil(data.height), minimumHeight), MAX_HEIGHT);
        frame.style.height = `${height}px`;
      }

      if (data.type === "auth") {
        container.dispatchEvent(
          new CustomEvent("aurora-layers:auth", { detail: { status: data.status } }),
        );
      }
    };

    container.dataset.auroraLayersMounted = "true";
    container.setAttribute("aria-busy", "true");
    window.addEventListener("message", onMessage);
    container.appendChild(frame);

    // A reload can emit ready before a host script receives the first message.
    frame.addEventListener("load", () => window.setTimeout(postToken, 0));
  }

  function mountAll(root = document) {
    root.querySelectorAll("[data-aurora-layers]").forEach(mount);
  }

  window.AuroraLayersEmbed = { mount, mountAll };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountAll(), { once: true });
  } else {
    mountAll();
  }
})();
