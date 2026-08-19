---
name: Play Store Android submission
description: Durable Android store-compliance and account-deletion policies
---
- Android v1 is consumption-only: no Play Billing, in-app purchases, or Aura top-ups in the app or listing; credits may describe spending and syncing.
- The sanctioned release path is a manual Play Console AAB upload; keep the version code advancing for each release.
- Account deletion must remove user-owned data explicitly, protect cleanup with authenticated storage paths, and retain a durable retry queue for post-auth cleanup failures.
- A public web deletion page is required in addition to in-app deletion; any legally retained records must be disclosed in the privacy policy.
