import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

const SOURCE = "aurora-layers";

type EmbedMessage = {
  source: typeof SOURCE;
  type: "ready" | "height" | "auth";
  height?: number;
  status?: "authenticated" | "error";
};

function addHostOrigin(src: string) {
  if (typeof window === "undefined") return src;

  try {
    const url = new URL(src, window.location.href);
    url.searchParams.set("hostOrigin", window.location.origin);
    return url.toString();
  } catch {
    return src;
  }
}

function originFor(src: string) {
  if (typeof window === "undefined") return null;

  try {
    return new URL(src, window.location.href).origin;
  } catch {
    return null;
  }
}

function normalizedHeight(value: number, fallback: number, minimum: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.ceil(value), minimum), 200000);
}

export type AuroraLayersEmbedProps = {
  /** Absolute URL of the deployed Aurora Layers /embed route. */
  src: string;
  /** Short-lived host-signed SSO token. It is sent by postMessage, never appended to the URL. */
  ssoToken?: string;
  title?: string;
  initialHeight?: number;
  minHeight?: number;
  className?: string;
  style?: CSSProperties;
  loading?: "eager" | "lazy";
  onAuth?: (status: "authenticated" | "error") => void;
  children?: ReactNode;
};

/**
 * Copy-paste React host for the self-contained Aurora Layers editor.
 * The component validates the iframe source before applying height or auth
 * messages and sends the SSO token only after the child announces readiness.
 */
export function AuroraLayersEmbed({
  src,
  ssoToken,
  title = "Aurora Layers Studio",
  initialHeight = 1400,
  minHeight = 360,
  className,
  style,
  loading = "lazy",
  onAuth,
  children,
}: AuroraLayersEmbedProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const safeMinHeight = useMemo(() => normalizedHeight(minHeight, 360, 1), [minHeight]);
  const safeInitialHeight = useMemo(
    () => normalizedHeight(initialHeight, 1400, safeMinHeight),
    [initialHeight, safeMinHeight],
  );
  const [height, setHeight] = useState(safeInitialHeight);
  const [ready, setReady] = useState(false);
  const embedSrc = useMemo(() => addHostOrigin(src), [src]);
  const iframeOrigin = useMemo(() => originFor(embedSrc), [embedSrc]);

  useEffect(() => {
    setHeight(safeInitialHeight);
    setReady(false);
  }, [safeInitialHeight, embedSrc]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<EmbedMessage>) => {
      if (
        !iframeOrigin ||
        event.origin !== iframeOrigin ||
        event.source !== frameRef.current?.contentWindow
      ) {
        return;
      }

      const data = event.data;
      if (!data || data.source !== SOURCE) return;

      if (data.type === "ready") {
        setReady(true);
      } else if (
        data.type === "height" &&
        typeof data.height === "number" &&
        Number.isFinite(data.height)
      ) {
        setHeight(normalizedHeight(data.height, safeMinHeight, safeMinHeight));
      } else if (
        data.type === "auth" &&
        (data.status === "authenticated" || data.status === "error")
      ) {
        onAuth?.(data.status);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeOrigin, safeMinHeight, onAuth]);

  useEffect(() => {
    if (!ready || !ssoToken || !iframeOrigin || !frameRef.current?.contentWindow) {
      return;
    }

    frameRef.current.contentWindow.postMessage(
      { source: SOURCE, type: "sso", token: ssoToken },
      iframeOrigin,
    );
  }, [ready, ssoToken, iframeOrigin]);

  return (
    <div className={className}>
      <iframe
        ref={frameRef}
        src={embedSrc}
        title={title}
        loading={loading}
        allow="clipboard-write; camera"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block w-full overflow-hidden rounded-3xl border-0 bg-[#0b0614]"
        style={{ ...style, height }}
      />
      {children}
    </div>
  );
}
