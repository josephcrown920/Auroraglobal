---
name: WebAuthn passkeys (Face ID / fingerprint)
description: rpID/origin policy, file layout, and how to E2E-test passkey ceremonies headlessly
---

Feature spans: `src/lib/webauthn.functions.ts` (client-callable server fns), `src/lib/webauthn-origins.ts` (pure origin/RP policy + unit tests), `src/routes/auth.lazy.tsx` (biometric sign-in + post-signup offer), `src/routes/settings.lazy.tsx` (Sign-in methods card), `src/hooks/use-biometric-support.ts`.

**rpID must derive from the validated client origin** on BOTH begin paths (registration and authentication), never from SITE_URL and never as free-form client input. SITE_URL-based rpID throws `SecurityError` in the browser on any dev/preview origin — and that error was invisible behind silent catches.
**Why:** the browser requires rp.id to be a registrable suffix of the page's domain; the server requires the origin to be one it actually serves.
**How to apply:** client passes `window.location.origin`; server checks `isAllowedOrigin()` (own domains only: SITE_URL, REPLIT_DOMAINS, REPLIT_DEV_DOMAIN, localhost outside prod — deliberately NO `*.replit.app`/`*.replit.dev` wildcards, foreign Replit apps must not be trusted) then uses `new URL(origin).hostname`. Keep policy logic in the pure module so bun can unit-test it.

**E2E testing works headlessly:** the testing subagent can drive real passkey ceremonies via CDP — `WebAuthn.enable` + `WebAuthn.addVirtualAuthenticator` (ctap2, transport internal, hasResidentKey + hasUserVerification + isUserVerified + automaticPresenceSimulation all true) BEFORE page load. This makes add → list → remove → sign-out → biometric sign-in fully verifiable. Discoverable-credential sign-in (no allowCredentials) needs the resident-key flags.

@simplewebauthn v10 is pinned: positional `startRegistration(options)` signature (v11 changed to `{ optionsJSON }` — check before upgrading). Sign-in completes via a Supabase magiclink `verifyOtp` bridge. Passkey userName/userDisplayName use the account email (OS passkey managers display it).
