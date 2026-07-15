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
import { Toaster } from "@/components/ui/sonner";
import { usePageViewTracking } from "@/hooks/use-tracking";
import { AuroraChatbot } from "@/components/AuroraChatbot";
import { AdminHotkey } from "@/components/AdminHotkey";
import { SiteImagesProvider } from "@/components/landing/SiteImagesProvider";
import { MobileNav } from "@/components/MobileNav";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { useEffect } from "react";
import { captureRefFromUrl } from "@/lib/referral";
import { ReferralAttacher } from "@/components/ReferralAttacher";
import { ThemeProvider } from "@/lib/theme-context";

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
        <button
          onClick={() => { if (typeof window !== "undefined") window.location.reload(); }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Refresh
        </button>
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
      { property: "og:site_name", content: "Aurora" },
      { property: "og:url", content: "https://auroraperformancestudio.com" },
      { title: "Aurora — AI Creative Studio for Artists & Performers" },
      { property: "og:title", content: "Aurora — AI Creative Studio for Artists & Performers" },
      { name: "twitter:title", content: "Aurora — AI Creative Studio for Artists & Performers" },
      { name: "description", content: "Turn one photo into magazine-grade performance shots, music-video stills, lip-sync videos and UGC ads — in seconds. The AI creative studio built for artists." },
      { property: "og:description", content: "Turn one photo into magazine-grade performance shots, music-video stills, lip-sync videos and UGC ads — in seconds. The AI creative studio built for artists." },
      { name: "twitter:description", content: "Turn one photo into magazine-grade performance shots, music-video stills, lip-sync videos and UGC ads — in seconds. The AI creative studio built for artists." },
      { property: "og:image", content: `https://auroraperformancestudio.com${auroraLogo.url}` },
      { name: "twitter:image", content: `https://auroraperformancestudio.com${auroraLogo.url}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@aurorastudio" },
      { name: "keywords", content: "AI creative studio, AI photos, performance shots, music video stills, lip sync video, UGC ads, artist photos, AI image generation" },
      { name: "robots", content: "index, follow" },
      { name: "theme-color", content: "#0b0814" },
      { name: "application-name", content: "Aurora" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: auroraLogo.url },
      { rel: "apple-touch-icon", href: auroraLogo.url },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Unbounded:wght@600;800&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Aurora",
          url: "https://auroraperformancestudio.com",
          description:
            "AI performance shots, music-video stills, lip-sync clips and UGC ads from a single selfie.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Aurora",
          url: "https://auroraperformancestudio.com",
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
  // --- Google Tag Manager ---------------------------------------------------
  // Paste your GTM Container ID (format: GTM-XXXXXXX) into the
  // VITE_GTM_CONTAINER_ID environment variable (Secrets tab). Once set, the
  // owner manages every tracking pixel (Meta, TikTok, GA4, etc.) from the GTM
  // dashboard with no further code changes or redeploys. When the variable is
  // unset or malformed, GTM is skipped entirely — no script, no iframe, no
  // console errors. The strict format check also keeps the value safe to inline
  // into the snippet below.
  const gtmRaw = import.meta.env.VITE_GTM_CONTAINER_ID as string | undefined;
  const gtmId =
    gtmRaw && /^GTM-[A-Z0-9]+$/i.test(gtmRaw.trim()) ? gtmRaw.trim() : null;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* FOUC prevention: set data-theme before first paint so the correct
            theme variables are in effect immediately, with no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('aurora-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        {/* Google Tag Manager — non-essential analytics, so it only loads once
            cookie consent allows it (GDPR/UK GDPR/CA). Mirrors the region
            heuristic + storage key in src/lib/consent.ts; this has to be a
            standalone inline script (no imports) because it must run before
            hydration. Re-evaluates on the aurora:cookie_consent_changed
            event so accepting via the banner loads GTM immediately without
            a reload, and it stays off entirely if the visitor declines. */}
        {gtmId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){
  try {
    var GTM_ID='${gtmId}';
    var KEY='aurora.cookie_consent.v1';
    var CONSENT_VERSION='2026-07-05';
    var REGULATED_COUNTRIES=["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","GB","IS","LI","NO","CA"];
    var CA_TZ=["America/St_Johns","America/Halifax","America/Moncton","America/Glace_Bay","America/Goose_Bay","America/Blanc-Sablon","America/Toronto","America/Nipigon","America/Thunder_Bay","America/Iqaluit","America/Pangnirtung","America/Resolute","America/Atikokan","America/Rankin_Inlet","America/Winnipeg","America/Rainy_River","America/Regina","America/Swift_Current","America/Edmonton","America/Cambridge_Bay","America/Yellowknife","America/Inuvik","America/Creston","America/Dawson_Creek","America/Fort_Nelson","America/Vancouver","America/Whitehorse","America/Dawson"];
    var EU_ATLANTIC=["Atlantic/Faroe","Atlantic/Canary","Atlantic/Madeira","Atlantic/Azores","Atlantic/Reykjavik"];
    function isRegulated(){
      try{
        var loc=(navigator.language||(navigator.languages&&navigator.languages[0])||"");
        var parts=loc.split("-");
        var country=parts.length>1?parts[parts.length-1].toUpperCase():null;
        if(country&&REGULATED_COUNTRIES.indexOf(country)!==-1)return true;
      }catch(e){}
      try{
        var tz=Intl.DateTimeFormat().resolvedOptions().timeZone||"";
        if(tz.indexOf("Europe/")===0)return true;
        if(EU_ATLANTIC.indexOf(tz)!==-1)return true;
        if(CA_TZ.indexOf(tz)!==-1)return true;
      }catch(e){}
      return false;
    }
    function hasConsent(){
      var raw=null;
      try{raw=localStorage.getItem(KEY);}catch(e){}
      if(raw){
        try{
          var parsed=JSON.parse(raw);
          if(parsed.version===CONSENT_VERSION){
            if(parsed.status==="declined")return false;
            if(parsed.status==="accepted")return true;
          }
        }catch(e){}
      }
      return !isRegulated();
    }
    function loadGtm(){
      if(window.__auroraGtmLoaded__)return;
      window.__auroraGtmLoaded__=true;
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',GTM_ID);
    }
    if(hasConsent())loadGtm();
    window.addEventListener("aurora:cookie_consent_changed",function(){if(hasConsent())loadGtm();});
  } catch(e) {}
})();`,
            }}
          />
        ) : null}
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  usePageViewTracking();
  useEffect(() => { captureRefFromUrl(); }, []);
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
  }, []);

  // NexusARB is an intentionally isolated, off-domain page: suppress all Aurora
  // chrome (chatbot, mobile nav, referral attacher, admin hotkey) so it stays
  // self-contained. Its route renders its own slim back-to-Aurora bar.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIsolated = pathname === "/nexusarb" || pathname.startsWith("/nexusarb/");

  if (isIsolated) {
    // NexusARB stays a self-contained, full-bleed page: no phone frame, no
    // chrome — except the cookie consent banner, which must be reachable on
    // every route for first-time EU/UK/CA visitors regardless of page.
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster />
        <CookieConsentBanner />
      </QueryClientProvider>
    );
  }

  // The app fills the full screen on any device — phone, tablet, or desktop —
  // adapting fluidly to the viewport width with no horizontal scroll.
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SiteImagesProvider>
          <div className="relative min-h-screen w-full overflow-x-hidden bg-background">
            <Outlet />
          </div>
        </SiteImagesProvider>
        <Toaster />
        <AuroraChatbot />
        <AdminHotkey />
        <ReferralAttacher />
        <MobileNav />
        <CookieConsentBanner />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
