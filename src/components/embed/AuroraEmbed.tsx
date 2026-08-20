import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

export type AuroraEmbedKind = "layers" | "scene-weaver" | "presets-engine";

type EmbedMessage = {
  source?: string;
  type?: "ready" | "height" | "auth";
  height?: unknown;
  status?: "authenticated" | "error";
};

const SOURCES: Record<AuroraEmbedKind, string> = {
  layers: "aurora-layers",
  "scene-weaver": "aurora-scene-weaver",
  "presets-engine": "aurora-presets-engine",
};

export type AuroraEmbedProps = {
  /** Absolute URL to the tool's /embed route. */
  src: string;
  kind: AuroraEmbedKind;
  title: string;
  className?: string;
  style?: CSSProperties;
  initialHeight?: number;
  minHeight?: number;
  /** Omit to allow the editor to grow to its real full height. */
  maxHeight?: number;
  loading?: "eager" | "lazy";
  /** Optional, short-lived Layers SSO token. Never persist this value in browser storage. */
  ssoToken?: string;
  onAuthChange?: (status: "authenticated" | "error") => void;
};

function embedOrigin(src: string): string | null {
  try {
    const origin = new URL(src).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

function withHostOrigin(src: string): string {
  if (typeof window === "undefined") return src;
  try {
    const url = new URL(src);
    url.searchParams.set("hostOrigin", window.location.origin);
    return url.toString();
  } catch {
    return src;
  }
}

/**
 * Drop-in iframe host for Aurora's independently deployed editor sections.
 * It manages only the iframe boundary; every tool retains its own visual system.
 */
export function AuroraEmbed({
  src,
  kind,
  title,
  className,
  style,
  initialHeight = 760,
  minHeight = 520,
  maxHeight,
  loading = "lazy",
  ssoToken,
  onAuthChange,
}: AuroraEmbedProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(() => Math.max(initialHeight, minHeight));
  const [ready, setReady] = useState(false);
  const origin = useMemo(() => embedOrigin(src), [src]);
  // Start with src for SSR hydration, then append the browser-only host origin.
  const [iframeSrc, setIframeSrc] = useState(src);

  useEffect(() => {
    setReady(false);
    setHeight(Math.max(initialHeight, minHeight));
    setIframeSrc(withHostOrigin(src));
  }, [initialHeight, minHeight, src]);

  const sendSsoToken = useCallback(() => {
    if (kind !== "layers" || !ssoToken || !origin || !frameRef.current?.contentWindow) return;
    frameRef.current.contentWindow.postMessage(
      { source: SOURCES.layers, type: "sso", token: ssoToken },
      origin,
    );
  }, [kind, origin, ssoToken]);

  useEffect(() => {
    if (!origin) return;
    const expectedSource = SOURCES[kind];

    const onMessage = (event: MessageEvent<EmbedMessage>) => {
      if (event.origin !== origin || event.source !== frameRef.current?.contentWindow) return;
      const message = event.data;
      if (message?.source !== expectedSource) return;

      if (message.type === "ready") {
        setReady(true);
        return;
      }

      if (message.type === "height" && typeof message.height === "number" && Number.isFinite(message.height)) {
        const upperBound = maxHeight ?? Number.MAX_SAFE_INTEGER;
        setHeight(Math.max(minHeight, Math.min(Math.ceil(message.height), upperBound)));
        return;
      }

      if (message.type === "auth" && (message.status === "authenticated" || message.status === "error")) {
        onAuthChange?.(message.status);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [kind, maxHeight, minHeight, onAuthChange, origin]);

  useEffect(() => {
    if (ready) sendSsoToken();
  }, [ready, sendSsoToken]);

  return (
    <iframe
      ref={frameRef}
      src={iframeSrc}
      title={title}
      loading={loading}
      referrerPolicy="strict-origin-when-cross-origin"
      allow="clipboard-read; clipboard-write"
      allowFullScreen
      onLoad={sendSsoToken}
      className={className}
      style={{
        display: "block",
        width: "100%",
        height,
        minHeight,
        border: 0,
        background: "transparent",
        ...style,
      }}
    />
  );
}