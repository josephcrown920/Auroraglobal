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
import { MobileNav } from "@/components/MobileNav";
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
      { name: "author", content: "Aurora Studio" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Aurora Studio" },
      { title: "Aurora Studio — AI Performance Shots & Music-Video Stills" },
      { property: "og:title", content: "Aurora Studio — AI Performance Shots & Music-Video Stills" },
      { name: "twitter:title", content: "Aurora Studio — AI Performance Shots & Music-Video Stills" },

      { property: "og:title", content: "Lovable App" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "description", content: "Aurora Studio Star creates performance-style shots from user photos and motion, adding virtual clothing and studio effects." },
      { property: "og:description", content: "Aurora Studio Star creates performance-style shots from user photos and motion, adding virtual clothing and studio effects." },
      { name: "twitter:description", content: "Aurora Studio Star creates performance-style shots from user photos and motion, adding virtual clothing and studio effects." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/J2VHaBkD8FVvbqRyLts8vf9CNTt2/social-images/social-1780019855212-IMG_7719.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/J2VHaBkD8FVvbqRyLts8vf9CNTt2/social-images/social-1780019855212-IMG_7719.webp" },
      { name: "twitter:card", content: "summary_large_image" },
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
          name: "Aurora Studio",
          url: "https://aurorastudiostar.lovable.app",
          description:
            "AI performance shots, music-video stills, lip-sync clips and UGC ads from a single selfie.",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Aurora Studio",
          url: "https://aurorastudiostar.lovable.app",
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
    <html lang="en">
      <head>
        <HeadContent />
        {/* FOUC prevention: set data-theme before first paint so the correct
            theme variables are in effect immediately, with no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('aurora-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
        {/* Google Tag Manager — fires on every page load when configured. */}
        {gtmId ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
        ) : null}
      </head>
      <body>
        {/* Google Tag Manager (noscript) — fallback for JS-disabled clients. */}
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="Google Tag Manager"
            />
          </noscript>
        ) : null}
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

  // NexusARB is an intentionally isolated, off-domain page: suppress all Aurora
  // chrome (chatbot, mobile nav, referral attacher, admin hotkey) so it stays
  // self-contained. Its route renders its own slim back-to-Aurora bar.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIsolated = pathname === "/nexusarb" || pathname.startsWith("/nexusarb/");

  if (isIsolated) {
    // NexusARB stays a self-contained, full-bleed page: no phone frame, no chrome.
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster />
      </QueryClientProvider>
    );
  }

  // The app fills the full screen on any device — phone, tablet, or desktop —
  // adapting fluidly to the viewport width with no horizontal scroll.
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <div className="relative min-h-screen w-full overflow-x-hidden bg-background">
          <Outlet />
        </div>
        <Toaster />
        <AuroraChatbot />
        <AdminHotkey />
        <ReferralAttacher />
        <MobileNav />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
