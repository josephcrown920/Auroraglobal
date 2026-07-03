---
name: Admin-created Supabase users lack a profile row
description: Users created directly via the Supabase Admin API (bypassing real signup/signin) don't get an app `profiles` row until they hit the app's own lazy-create path.
---

Creating a test user via the Supabase Admin API (`auth.admin.createUser`,
pre-confirmed) creates the `auth.users` row but does NOT create a matching
row in this app's own `profiles` table. In this codebase, `profiles` is
created lazily inside `getMyProfile` (`billing.functions.ts`) the first time
an authenticated request needs it — keyed by `profiles.user_id` (a foreign
key), NOT `profiles.id` (the profile's own primary key) — and it also grants
that month's free-tier Aura via `grant_monthly_aura` at creation time.

**Why:** a direct-invocation test script (see
[Direct-invocation testing](direct-invocation-testing.md)) that skips the
browser/HTTP layer also skips this lazy-create path, so querying
`profiles.credits` for a freshly admin-created user fails with "Cannot
coerce the result to a single JSON object" (no row) — and even after
insertion, querying by `.eq("id", userId)` instead of `.eq("user_id",
userId)` silently returns the wrong/no row.

**How to apply:** for any direct-invocation test against an admin-created
user, check for an existing `profiles` row by `user_id` first; if absent,
insert one manually with the desired starting `credits` (mirroring what
`getMyProfile` would do) before exercising the credit-charging flow.
