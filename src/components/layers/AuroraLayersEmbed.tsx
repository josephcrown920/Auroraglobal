import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

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
  const [height, setHeight] = useState(1400);
  const [ready, setReady] = useState(false);
  const [ssoError, setSsoError] = useState(false);
  const embedSrc = useMemo(() => withHostOrigin(LAYERS_SRC), []);
  const iframeOrigin = useMemo(() => new URL(embedSrc).origin, [embedSrc]);

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
      } else if (data.type === "auth") {
        setSsoError(data.status === "error");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeOrigin]);

  useEffect(() => {
    let cancelled = false;

    const syncSession = async () => {
      if (!ready || !user || !frameRef.current?.contentWindow) return;

      const { data, error } = await supabase.auth.getSession();
      if (cancelled || error || !data.session?.access_token) {
        if (!cancelled && error) setSsoError(true);
        return;
      }

      setSsoError(false);
      frameRef.current.contentWindow.postMessage(
        {
          source: SOURCE,
          type: "sso",
          token: data.session.access_token,
        },
        iframeOrigin,
      );
    };

    void syncSession();
    return () => {
      cancelled = true;
    };
  }, [ready, user, iframeOrigin]);

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
      {ssoError && (
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          Layers opened, but your Aurora account could not be synced. You can continue in local mode.
        </p>
      )}
    </div>
  );
}
