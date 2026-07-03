---
name: Admin-created Supabase users and their profile row
description: How a `profiles` row (and starting credits) gets created for a user made via the Supabase Admin API, and where the RLS-keyed lookup column is.
---

As of the migration that added `on_auth_user_created` / `handle_new_user`
(2026-06-12), a `profiles` row IS created automatically for any insert into
`auth.users` — including `auth.admin.createUser(...)` from a direct-invocation
test script, not just real signup/signin. The trigger grants 5 free signup
credits and writes a `credit_ledger` entry at creation time. An earlier
version of this note claimed admin-created users get no profile row at all
(true only for older schema revisions before this trigger existed) — always
verify against the live `handle_new_user` trigger/migration rather than
trusting that claim blindly.

Regardless of how the row was created, always query/update `profiles` by
`.eq("user_id", userId)` — `profiles.user_id` is the FK to `auth.users.id`,
NOT `profiles.id` (the profile's own PK). Querying by `.eq("id", userId)`
silently returns the wrong/no row.

**Why:** a direct-invocation test script (see
[Direct-invocation testing](direct-invocation-testing.md)) that skips the
browser/HTTP layer still benefits from this trigger, so a fresh admin-created
user already has 5 credits — top up further with the `grant_credits` RPC
(service-role) if the test needs more than that.

**How to apply:** for a direct-invocation test against an admin-created user,
you can rely on the auto-created profile row; call `grant_credits` RPC first
if the flow under test costs more than 5 credits, and always filter
`profiles` by `user_id`.
