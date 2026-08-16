---
name: Play Store Android submission
description: How Aurora Studio ships to Google Play — sanctioned upload path and store-compliance requirements
---
- Manual Play Console AAB upload is the only sanctioned Android submission path (per Replit's mobile-publishing docs). Automated submission tooling and service-account keys are out entirely — store docs must present the manual path exclusively, with no "optional automation" mentions; completion reviews reject on any lingering automation reference.
- Keep a local copy of each production AAB in the workspace — hosted build-download links expire after roughly a month. Bump the Android version code for every new upload.
- Consumption-only v1: no purchase/top-up language anywhere in the app or the store listings (Play/Apple digital-goods rules). Credits copy may describe spending and syncing, never buying.
- Store-compliant account deletion must delete every user-owned table explicitly (auth-user deletion cascades almost nothing), must fail the request before touching rows when storage cleanup fails (a retry then sees an intact account), and must re-sweep after auth deletion because in-flight jobs write rows mid-request (observed live). Post-auth sweep failures need a durable retry queue drained by a scheduled job — the login is already gone, so silently reporting success would strand undeletable data.
- Every user-generated storage object must live under a uid-prefixed namespace and every upload endpoint must be auth-gated: anonymous timestamp-named paths are undiscoverable by account deletion (a compliance bug), and an unauthenticated upload route is an open storage-consumption hole.
- Play production also requires a public web deletion page usable without reinstalling the app; in-app deletion alone passes internal testing only. Anything retained post-deletion (financial and consent records here) must be named in the privacy policy.
