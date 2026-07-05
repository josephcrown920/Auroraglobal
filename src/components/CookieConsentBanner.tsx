import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie } from "lucide-react";
import {
  shouldShowConsentBanner,
  setConsentStatus,
  OPEN_CONSENT_MANAGER_EVENT,
  type ConsentStatus,
} from "@/lib/consent";

// GDPR (EU) / UK GDPR / CA cookie-consent banner. Only shows on first visit
// to visitors whose browser locale/timezone looks EU, UK, or Canadian (see
// consent.ts — there's no IP-geolocation backend to do this precisely).
// Declining blocks non-essential analytics everywhere; accepting or
// declining is remembered so the banner doesn't reappear. A "Cookie
// preferences" link in the footer can reopen it via a custom event.
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(shouldShowConsentBanner());
    const reopen = () => setVisible(true);
    window.addEventListener(OPEN_CONSENT_MANAGER_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_MANAGER_EVENT, reopen);
  }, []);

  if (!visible) return null;

  const respond = (status: ConsentStatus) => {
    setConsentStatus(status);
    setVisible(false);
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
