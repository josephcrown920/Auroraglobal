---
name: Auth redirect guards fire twice (pathname-keyed route wrapper)
description: Why sign-in return paths silently vanished app-wide, and the rule for any effect that redirects to /auth.
---

**Rule:** any effect that redirects a signed-out visitor to `/auth` must be safe to run a second
time while the URL already reads `/auth` — either skip (`isAuthRedirectInFlight()`) or re-apply
the `next` already in the URL (`authNextSearch()` does this). Never navigate to a bare `/auth`
from a guard.

**Why:** the root layout keys its route wrapper on the pathname, so the instant a guard redirects,
the still-pending old page REMOUNTS and its guard effect runs again. A second
`navigate({ to: "/auth" })` without search replaced `/auth?next=/studio` with `/auth`, so every
protected route (dozens of inline guards) lost its return path; only the e2e for `/admin`
caught it. Stable `useNavigate` identity does not protect against this — it's a remount.

**How to apply:** verify redirects with a Playwright `framenavigated` trace (sequence should end
at `/auth?next=…`, not a trailing bare `/auth`); a unit test on the helper is not enough.
