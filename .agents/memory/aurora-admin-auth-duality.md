---
name: Aurora has TWO admin credentials, and owner-only gates are UI-level
description: Admin API routes must accept both the passcode header and a Supabase bearer; and "owner only" products gate visibility, not the shared generate endpoint.
---

## Two different admin credentials are in play

Aurora authenticates admins two ways, and which one a caller holds depends on
where the UI lives:

- **`x-aurora-admin: <ADMIN_PASSCODE>`** — sent by the `/admin*` dashboard pages,
  which unlock behind a shared owner passcode stored in `sessionStorage`.
- **`Authorization: Bearer <supabase access token>`** — sent by admin widgets
  embedded in normal pages (e.g. the floating "Edit landing" pill on the landing
  page), which have a Supabase session but never see the passcode.

**Why:** an admin API route that accepts only one of these works from one surface
and returns 403 from the other. This already shipped once as a silently broken
landing-image uploader.

**How to apply:** any new `/api/admin/*` route should accept BOTH, and the bearer
path must be verified server-side — decode the token with the service-role client,
then check the `admin` row in `user_roles`. Never trust a role claim from the client.
Also fail CLOSED on any allowlist you validate against: if the list can't be loaded
or comes back empty, refuse rather than accepting arbitrary input.

## "Owner only" products gate visibility, not capability

Owner-only surfaces (e.g. the Adult School artifact) check for the `admin` role in
`user_roles` client-side. That is a real check — `user_roles` is RLS'd so a user can
read only their own rows, cannot read anyone else's, and cannot self-grant — but it
gates **who sees the product**, not the backend.

**Why:** these products call the same shared `/api/public/generate` as everything
else, which only requires an authenticated, credit-bearing user. Locking that
endpoint to admins would break the entire app. The privileged thing being protected
is the curated preset/prompt library and the UI, not a special server capability.

**How to apply:** don't accept a review note demanding server-side admin enforcement
on the shared generation path. Do confirm that any table the product reads history
from (e.g. `generations`) is RLS-scoped to `auth.uid() = user_id`, since that is
where a genuine cross-user leak would occur.
