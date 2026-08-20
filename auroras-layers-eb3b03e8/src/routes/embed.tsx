import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { LayerStudio } from "@/components/LayerStudio";
import { allowedEmbedOrigins } from "@/lib/embedCors";
import { onHostSsoToken, postAuth, postReady, startHeightReporting } from "@/lib/embedFrame";
import {
  hasSession,
  readSsoTokenFromUrl,
  scrubSsoTokenFromUrl,
  signInWithEmbedToken,
  type EmbedSsoStatus,
} from "@/lib/embedSso";

/**
 * Origins allowed to frame the embed and call it. Configure with
 * AURORA_EMBED_ALLOWED_ORIGINS (comma separated). Values must be exact HTTPS
 * origins; no configured origin means external framing is disabled.
 */
function frameAncestors(): string {
  return ["'self'", ...allowedEmbedOrigins()].join(" ");
}

export const Route = createFileRoute("/embed")({
  component: EmbedPage,
  // Server response headers for the embed document.
  // NOTE: X-Frame-Options is intentionally NOT set — it cannot express an
  // allow-list and would block framing entirely. CSP frame-ancestors is the
  // modern replacement and every current browser honours it.
  headers: () => ({
    "Content-Security-Policy": `frame-ancestors ${frameAncestors()}`,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "cross-origin",
  }),
  head: () => ({
    meta: [
      { title: "Aurora Layers Studio — Embedded Editor" },
      {
        name: "description",
        content:
          "Embeddable Aurora Layers studio: upload a frame, name a layer, re-render only that element while the rest of the frame stays locked.",
      },
      { property: "og:title", content: "Aurora Layers Studio — Embedded Editor" },
      {
        property: "og:description",
        content:
          "Drop the Aurora Layers editor into any site. Same brand, same engines, same exports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function EmbedPage() {
  const [sso, setSso] = useState<EmbedSsoStatus>("idle");

  // Auto-size the iframe in the host layout.
  useEffect(() => {
    postReady();
    return startHeightReporting();
  }, []);

  // Optional token SSO: ?sso=<token> on the iframe URL, or a postMessage
  // { source: "aurora-layers", type: "sso", token } from the host.
  useEffect(() => {
    let cancelled = false;

    const exchange = async (token: string) => {
      if (cancelled) return;
      setSso("pending");
      const ok = await signInWithEmbedToken(token);
      if (cancelled) return;
      scrubSsoTokenFromUrl();
      setSso(ok ? "authenticated" : "error");
      postAuth(ok ? "authenticated" : "error");
    };

    void (async () => {
      if (await hasSession()) {
        if (!cancelled) setSso("authenticated");
        return;
      }
      const token = readSsoTokenFromUrl();
      if (token) void exchange(token);
    })();

    const off = onHostSsoToken((token) => void exchange(token));
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {sso === "pending" && (
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Syncing your session…
          </p>
        )}
        {sso === "error" && (
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-destructive">
            Session sync failed — working in local mode
          </p>
        )}
        <LayerStudio />
      </div>
    </main>
  );
}
