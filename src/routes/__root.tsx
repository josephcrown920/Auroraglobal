import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import auroraLogo from "@/assets/aurora-logo.png.asset.json";
import { CANONICAL_ORIGIN } from "@/lib/seo";
import { Toaster } from "@/components/ui/sonner";
import { usePageViewTracking } from "@/hooks/use-tracking";
import { useAuth, hasStoredSession } from "@/hooks/use-auth";
import { AuroraChatbot } from "@/components/AuroraChatbot";
import { AdminHotkey } from "@/components/AdminHotkey";
import { SiteImagesProvider } from "@/components/landing/SiteImagesProvider";
import { SiteCopyProvider } from "@/components/landing/SiteCopyProvider";
import { FeatureVisibilityProvider } from "@/components/FeatureVisibilityProvider";
import { MobileNav } from "@/components/MobileNav";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { useEffect, useState } from "react";
import { captureRefFromUrl } from "@/lib/referral";
import { ReferralAttacher } from "@/components/ReferralAttacher";
import { DesignSkinApplier } from "@/components/DesignSkinApplier";
import { ThemeProvider } from "@/lib/theme-context";
import { initCrashReporting } from "@/lib/crash-reporting";
import { reloadOnceForStaleChunk } from "@/lib/stale-chunk";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CONSENT_CHANGED_EVENT, hasAnalyticsConsent } from "@/lib/consent";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error; reset: () => void }) {
  // Render a stable fallback instead of returning null — returning null caused
  // the landing page to flash black during transient SSR/hydration errors.
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page hit an unexpected error. Refresh to try again.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-white/5"
          >
            ← Back to home
          </Link>
          <button
            onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "Aurora" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Aurora Performance Studio" },
      { property: "og:url", content: CANONICAL_ORIGIN },
      { title: "Aurora — AI Creative Studio for Artists & Performers" },
      { property: "og:title", content: "Aurora — AI Creative Studio for Artists & Performers" },
      { name: "twitter:title", content: "Aurora — AI Creative Studio for Artists & Performers" },
      { name: "description", content: "Turn one photo into magazine-grade performance shots, music-video stills, lip-sync videos and UGC ads — in seconds. Built by pro artists, for artists who need to scale massively." },
      { property: "og:description", content: "Turn one photo into magazine-grade performance shots, music-video stills, lip-sync videos and UGC ads — in seconds. Built by pro artists, for artists who need to scale massively." },
      { name: "twitter:description", content: "Turn one photo into magazine-grade performance shots, music-video stills, lip-sync videos and UGC ads — in seconds. Built by pro artists, for artists who need to scale massively." },
      { property: "og:image", content: `${CANONICAL_ORIGIN}/landing/reel-poster.jpg` },
      { name: "twitter:image", content: `${CANONICAL_ORIGIN}/landing/reel-poster.jpg` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@aurorastudio" },
      { name: "keywords", content: "AI creative studio, AI photos, performance shots, music video stills, lip sync video, UGC ads, artist photos, AI image generation" },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", content: "#0b0814" },
      { name: "application-name", content: "Aurora" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/png", href: auroraLogo.url },
      { rel: "apple-touch-icon", href: auroraLogo.url },
      { rel: "preload", href: "/fonts/unbounded-600-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/fonts/unbounded-800-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "preload", href: "/fonts/bebasneue-latin.woff2", as: "font", type: "font/woff2", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "/fonts/fonts.css" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Aurora",
          url: CANONICAL_ORIGIN,
          logo: `${CANONICAL_ORIGIN}/icons/aurora-icon-512.png`,
          description:
            "AI performance shots, music-video stills, lip-sync clips and UGC ads from a single selfie. Built by pro artists, for artists who need to scale massively.",
          contactPoint: {
            "@type": "ContactPoint",
            email: "support@auroraperformancestudio.com",
            contactType: "customer support",
          },
          sameAs: [
            "https://twitter.com/aurorastudio",
            "https://www.tiktok.com/@aurorastudio",
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Aurora",
          url: CANONICAL_ORIGIN,
        }),
      },
    ],
  }),
  beforeLoad: ({ location }) => {
    const { pathname, searchStr, hash } = location;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      const stripped = pathname.replace(/\/+$/, "") || "/";
      throw redirect({
        href: `${stripped}${searchStr ?? ""}${hash ? `#${hash}` : ""}`,
        statusCode: 301,
      });
    }
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Hide the Replit "Built on Replit" deployment badge — Aurora is a
            paid product and the badge undercuts trust with real users. The
            badge is injected by Replit's serving infrastructure as
            <div id="replit-badge"> so a single CSS rule is enough. */}
        <style dangerouslySetInnerHTML={{ __html: "#replit-badge{display:none!important}" }} />
        {/* FOUC prevention: set data-theme before first paint so the correct
            theme variables are in effect immediately, with no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('aurora-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {/* No <noscript> GTM fallback: with JS disabled there is no way to
            show the consent banner or read a consent decision, so the only
            compliant option for JS-disabled visitors is to not load
            non-essential tracking for them at all. */}
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// The most-visited lazy routes — their JS chunks get warmed during idle time
// after the first page settles, so the very first navigation is instant even
// without a hover (touch devices never hover). Hard-coded
// <link rel="modulepreload"> tags can't do this job here: the prod build
// hashes chunk filenames, so router.preloadRoute() (which resolves the real
// chunk in both dev and prod) is the reliable equivalent.
const IDLE_WARM_ROUTES = ["/studio", "/motion", "/lipsync", "/spin", "/agent"] as const;

function useIdleRouteWarmup() {
  const router = useRouter();
  useEffect(() => {
    // Respect constrained connections — warming 5 chunks is pure waste on
    // data-saver or 2G, where the bandwidth is better spent on the visible page.
    const conn = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (conn?.saveData || /2g/.test(conn?.effectiveType ?? "")) return;

    const warm = () => {
      for (const to of IDLE_WARM_ROUTES) {
        void router.preloadRoute({ to }).catch(() => {
          // Best-effort: a failed warmup must never surface — the route will
          // simply load on demand as before.
        });
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(warm, { timeout: 8000 });
      return () => window.cancelIdleCallback(handle);
    }
    // Safari has no requestIdleCallback — a short delay past hydration is a
    // fine approximation of "idle after initial load".
    const t = window.setTimeout(warm, 3000);
    return () => window.clearTimeout(t);
  }, [router]);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { user, loading: authLoading } = useAuth();
  // Optimistic chrome for returning users: a stored Supabase token means this
  // is almost certainly a signed-in creator whose session is still being
  // verified over the network. Starting at false keeps the first client paint
  // identical to SSR (no hydration mismatch); the effect flips it one frame
  // after hydration, so the sidebar appears immediately instead of after the
  // getSession() round-trip.
  const [hasStoredAuth, setHasStoredAuth] = useState(false);
  useEffect(() => {
    setHasStoredAuth(hasStoredSession());
  }, []);
  usePageViewTracking();
  useDeferredGtm();
  useIdleRouteWarmup();
  useEffect(() => { captureRefFromUrl(); initCrashReporting(); }, []);
  useEffect(() => {
    // After a redeploy, a failed chunk preload (hover-triggered) would surface
    // as an unhandled rejection and leave navigation dead. Recover with the
    // same guarded one-shot reload the router's error fallback uses; if the
    // guard refuses (already reloaded recently), let the error propagate so
    // the route error card renders instead of looping.
    const onPreloadError = (event: Event) => {
      if (reloadOnceForStaleChunk(window.location.pathname)) event.preventDefault();
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () => window.removeEventListener("vite:preloadError", onPreloadError);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.auroraHydrated = "true";
    return () => {
      delete document.documentElement.dataset.auroraHydrated;
    };
  }, []);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    } else {
      // Dev: a service worker must NEVER intercept the vite dev server —
      // cached dev HTML references stale module URLs, which breaks hydration
      // (nav appears dead) and slows loads. Unregister anything left over and
      // purge Aurora caches so previously-affected browsers recover.
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .catch(() => {});
      if ('caches' in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.filter((k) => k.startsWith('aurora-')).map((k) => caches.delete(k))))
          .catch(() => {});
      }
    }
  }, []);

  // NexusARB is an intentionally isolated, off-domain page: suppress all Aurora
  // chrome (chatbot, mobile nav, referral attacher, admin hotkey) so it stays
  // self-contained. Its route renders its own slim back-to-Aurora bar.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIsolated = pathname === "/nexusarb" || pathname.startsWith("/nexusarb/");
  const isVideoAgent = pathname === "/video-agent" || pathname.startsWith("/video-agent/");
  // /agent is the Aurora Prime director workspace — it IS the agent chat, so the
  // floating Aurora Prime bubble would put two agents on the same page.
  const isPrimeAgent = pathname === "/agent" || pathname.startsWith("/agent/");
  // /edit is a full-screen CapCut-style editor: it owns the whole viewport
  // (h-dvh stage + timeline + tool dock), so the tab bar and chat bubble
  // would overlap its dock — hide them there, like on the video agent.
  const isFullScreenEditor = pathname === "/edit";
  // The persistent sidebar / tab-bar chrome is app navigation for signed-in
  // creators only. Logged-out visitors (landing, public pages) get each page's
  // own nav — never the studio sidebar. While the session is still resolving,
  // a stored token renders the chrome optimistically so returning users never
  // see the app shell pop in after a network round-trip; once loading settles,
  // the verified user is authoritative (an invalid stored token drops it).
  const hasPersistentNavigation =
    !isVideoAgent && !isFullScreenEditor && (!!user || (authLoading && hasStoredAuth));

  if (isIsolated) {
    // NexusARB stays a self-contained, full-bleed page: no phone frame, no
    // chrome — except the cookie consent banner, which must be reachable on
    // every route for first-time EU/UK/CA visitors regardless of page. The
    // feature-visibility provider is NOT chrome: the route's FeatureGuard reads
    // its server-verified admin verdict, and without the provider the guard
    // sits on the unloaded default context forever — blank for admins and
    // non-admins alike, never rendering and never redirecting. The error
    // boundary wraps this branch too: a crash inside the isolated tree must
    // not escape the app's recovery UI.
    return (
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <FeatureVisibilityProvider>
            <Outlet />
            <Toaster />
            <CookieConsentBanner />
          </FeatureVisibilityProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    );
  }

  // The app fills the full screen on any device — phone, tablet, or desktop —
  // adapting fluidly to the viewport width with no horizontal scroll.
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <FeatureVisibilityProvider>
            <SiteImagesProvider>
              <SiteCopyProvider>
                <div
                  className="relative min-h-screen w-full overflow-x-hidden bg-background"
                >
                  <div key={pathname} className="aurora-route-enter">
                    <Outlet />
                  </div>
                </div>
              </SiteCopyProvider>
            </SiteImagesProvider>
            <Toaster />
            <DesignSkinApplier />
            {!isVideoAgent && !isPrimeAgent && !isFullScreenEditor && <AuroraChatbot />}
            <AdminHotkey />
            <ReferralAttacher />
            {hasPersistentNavigation && <MobileNav />}
            <CookieConsentBanner />
          </FeatureVisibilityProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

declare global {
  interface Window {
    __auroraGtmLoaded__?: boolean;
    dataLayer?: unknown[];
  }
}

const gtmRaw = import.meta.env.VITE_GTM_CONTAINER_ID as string | undefined;
const GTM_CONTAINER_ID =
  gtmRaw && /^GTM-[A-Z0-9]+$/i.test(gtmRaw.trim()) ? gtmRaw.trim() : null;

function loadGtm(containerId: string) {
  if (typeof window === "undefined" || window.__auroraGtmLoaded__) return;

  window.__auroraGtmLoaded__ = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  script.dataset.auroraGtm = "true";
  document.head.appendChild(script);
}

function useDeferredGtm() {
  useEffect(() => {
    if (!GTM_CONTAINER_ID) return;

    const maybeLoadGtm = () => {
      if (hasAnalyticsConsent()) loadGtm(GTM_CONTAINER_ID);
    };

    // This runs after hydration, so the analytics script can never block the
    // initial HTML parse or first paint. Consent changes still load GTM
    // immediately for visitors who accept through the banner.
    const timer = window.setTimeout(maybeLoadGtm, 0);
    window.addEventListener(CONSENT_CHANGED_EVENT, maybeLoadGtm);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(CONSENT_CHANGED_EVENT, maybeLoadGtm);
    };
  }, []);
}
