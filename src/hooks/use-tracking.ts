import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { trackPageView } from "@/lib/tracking";
import { CONSENT_CHANGED_EVENT, hasAnalyticsConsent } from "@/lib/consent";
import { capturePageView, identifyPosthogUser, resetPosthogUser } from "@/lib/posthog";
import { supabase } from "@/integrations/supabase/client";

/** Mount once at the root — emits page_view on every route change. */
export function usePageViewTracking() {
  const router = useRouter();
  useEffect(() => {
    const emit = (path: string) => {
      trackPageView(path);
      // PostHog is gated on the same cookie-consent decision as our own
      // `events` table and GTM (see consent.ts) — never fires for a
      // visitor who declined or hasn't decided yet.
      if (hasAnalyticsConsent()) capturePageView(path);
    };
    // initial
    emit(router.state.location.pathname);
    const unsub = router.subscribe("onResolved", ({ toLocation }) => {
      emit(toLocation.pathname);
    });

    // A visitor who accepts the consent banner mid-session shouldn't have to
    // navigate again before PostHog starts — fire immediately, same as the
    // GTM inline loader in __root.tsx already does for that script. A
    // visitor who declines (or reopens the banner and revokes) gets reset
    // immediately too, clearing any identified user / stored PostHog state.
    const onConsentChanged = () => {
      if (hasAnalyticsConsent()) {
        capturePageView(router.state.location.pathname);
        // If they were already signed in before answering the banner,
        // useAuth's initial load ran with consent still absent and
        // skipped identify() — do it now so their activity is attributed
        // to their account instead of staying anonymous until next reload.
        void supabase.auth.getSession().then(({ data }) => {
          if (data.session?.user) identifyPosthogUser(data.session.user.id);
        });
      } else {
        resetPosthogUser();
      }
    };
    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);

    return () => {
      unsub();
      window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChanged);
    };
  }, [router]);
}
