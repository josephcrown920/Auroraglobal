import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getAuroraLayersEmbedSession } from "@/lib/layers-embed.functions";

const SOURCE = "aurora-layers" as const;
const LAYERS_SRC =
  import.meta.env.VITE_AURORA_LAYERS_URL ??
  "https://build-it-magic-49.lovable.app/embed";

type EmbedMessage = {
  source: typeof SOURCE;
  type: "ready" | "height" | "auth";
  height?: number;
  status?: "authenticated" | "error";
};

function withHostOrigin(src: string) {
  if (typeof window === "undefined") return src;
  const url = new URL(src, window.location.href);
  url.searchParams.set("hostOrigin", window.location.origin);
  return url.toString();
}

function clampHeight(value: number, fallback = 1400, minimum = 420) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(Math.max(Math.ceil(value), minimum), 200000);
}

export function AuroraLayersEmbed() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const { user } = useAuth();
  const getSession = useServerFn(getAuroraLayersEmbedSession);
  const [height, setHeight] = useState(1400);
  const [ready, setReady] = useState(false);
  const embedSrc = useMemo(() => withHostOrigin(LAYERS_SRC), []);
  const iframeOrigin = useMemo(() => new URL(embedSrc).origin, [embedSrc]);
  const hostOrigin = typeof window === "undefined" ? "" : window.location.origin;

  const sessionQuery = useQuery({
    queryKey: ["aurora-layers-embed-session", user?.id, hostOrigin],
    queryFn: () => getSession({ data: { origin: hostOrigin } }),
    enabled: Boolean(user && hostOrigin),
    staleTime: 45_000,
    retry: false,
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent<EmbedMessage>) => {
      if (
        event.origin !== iframeOrigin ||
        event.source !== frameRef.current?.contentWindow
      ) return;

      const data = event.data;
      if (!data || data.source !== SOURCE) return;

      if (data.type === "ready") {
        setReady(true);
      } else if (data.type === "height" && typeof data.height === "number") {
        setHeight(clampHeight(data.height));
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeOrigin]);

  useEffect(() => {
    const token = sessionQuery.data?.token;
    if (!ready || !token || !frameRef.current?.contentWindow) return;

    frameRef.current.contentWindow.postMessage(
      { source: SOURCE, type: "sso", token },
      iframeOrigin,
    );
  }, [ready, sessionQuery.data?.token, iframeOrigin]);

  return (
    <div className="w-full min-w-0">
      <iframe
        ref={frameRef}
        src={embedSrc}
        title="Aurora Layers Studio"
        loading="eager"
        allow="clipboard-write; camera"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block w-full overflow-hidden rounded-3xl border-0 bg-[#0b0614]"
        style={{ height }}
      />
      {sessionQuery.isError && (
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          Layers is open, but account SSO could not be synced. Check the Aurora Layers embed secret and allowed origins.
        </p>
      )}
    </div>
  );
}
