import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Cookie } from "lucide-react";
import {
  setConsentStatus,
  getConsentStatus,
  isRegulatedRegion,
  OPEN_CONSENT_MANAGER_EVENT,
  type ConsentStatus,
} from "@/lib/consent";
import { syncConsentForSession } from "@/lib/consent-sync";
import { getServerConsent, saveServerConsent } from "@/lib/consent.functions";
import { supabase } from "@/integrations/supabase/client";

// GDPR (EU) / UK GDPR / CA cookie-consent banner. Only shows on first visit
// to visitors whose browser locale/timezone looks EU, UK, or Canadian (see
// consent.ts — there's no IP-geolocation backend to do this precisely).
// Declining blocks non-essential analytics everywhere; accepting or
// declining is remembered so the banner doesn't reappear. A "Cookie
// preferences" link in the footer can reopen it via a custom event.
//
// Authenticated users: consent is synced server-side so a choice made on one
// device pre-seeds every other device. The server preference is authoritative:
// if the server has a stored value it always wins over a local one. The local
// value is only pushed to the server when the server has no preference yet.
// Anonymous/logged-out visitors keep the localStorage-only behaviour.
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  // Prevent double-syncing when the same user's session appears multiple times.
  const syncedUserRef = useRef<string | null>(null);

  const getServerConsentFn = useServerFn(getServerConsent);
  const saveServerConsentFn = useServerFn(saveServerConsent);

  const runSync = async (userId: string | null) => {
    // Skip if we already synced for this user this session.
    if (userId !== null && syncedUserRef.current === userId) return;
    if (userId !== null) syncedUserRef.current = userId;

    const result = await syncConsentForSession(userId, {
      getServerConsent: () => getServerConsentFn(),
      saveServerConsent: (status) =>
        saveServerConsentFn({ data: { status } }).catch(() => {/* ignore */}),
      getLocalConsent: getConsentStatus,
      setLocalConsent: setConsentStatus,
      isRegulatedRegion,
    });

    if (result.action === "show") {
      setVisible(true);
    } else {
      setVisible(false);
    }
  };

  useEffect(() => {
    // Re-open listener so the footer "Cookie preferences" link works.
    const reopen = () => setVisible(true);
    window.addEventListener(OPEN_CONSENT_MANAGER_EVENT, reopen);

    // 1. Sync immediately for the current session (covers page load).
    supabase.auth.getSession().then(({ data: { session } }) => {
      void runSync(session?.user.id ?? null);
    });

    // 2. React to sign-in events so a user who logs in without reloading the
    //    page gets their server preference applied on the spot.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void runSync(session?.user.id ?? null);
    });

    return () => {
      window.removeEventListener(OPEN_CONSENT_MANAGER_EVENT, reopen);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const respond = (status: ConsentStatus) => {
    setConsentStatus(status);
    setVisible(false);
    // Persist server-side for authenticated users (fire-and-forget).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        saveServerConsentFn({ data: { status } }).catch(() => {/* ignore */});
      }
    });
  };

  return (
    // Anchored well above the bottom nav (4rem), the credits offer bar
    // (~4rem more), and the chat bubble (5rem) so it never stacks on top of
    // them — see MobileNav.tsx / StickyCreditsBar.tsx / AuroraChatbot.tsx.
    <div className="phone-fixed-x fixed bottom-[calc(9rem_+_env(safe-area-inset-bottom))] z-[65] px-3 pointer-events-none animate-fade-in">
      <div
        role="region"
        aria-label="Cookie consent"
        className="pointer-events-auto mx-auto max-w-xl rounded-2xl border border-border bg-background/95 backdrop-blur-xl px-5 py-4 shadow-2xl shadow-black/30"
      >
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="flex-1 text-sm">
            <p className="text-muted-foreground">
              We use essential local storage to keep you signed in, plus optional analytics to
              improve Aurora. You can accept or decline non-essential analytics — see our{" "}
              <Link
                to="/legal/$slug"
                params={{ slug: "cookies" }}
                className="underline text-foreground hover:text-primary"
              >
                Cookie Policy
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => respond("accepted")}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Accept analytics
              </button>
              <button
                type="button"
                onClick={() => respond("declined")}
                className="rounded-full border border-border bg-transparent px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
