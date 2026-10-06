---
name: Admin authorization model (route boundary, nav gating, passcode)
description: The decisions behind /admin access control and the traps that bit while building it — read before touching admin nav, /admin routes, or the owner passcode.
---

**Decisions**
- Client-side admin visibility (nav entries, `/admin*` rendering) keys ONLY off the provider's server-verified admin state. A stored passcode token is a credential the server validates on each call — never an "unlocked" flag. Don't reintroduce per-page unlock hooks; the `/admin` layout boundary is the single client gate.
- The owner passcode form is offered only when a hidden entrance explicitly requested it (sessionStorage marker); plain `/admin*` navigation by a non-admin is redirected. The marker grants nothing.
- The passcode is a hybrid, pre-existing credential: some `/api/admin/*` routes accept it alone, while the admin server functions require the Supabase `admin` role — so a passcode-only account (no role row) reaches the console shell but gets role errors on data. Kept deliberately (task scope: "keep existing server checks"); reconciling it is a separate decision.
- Every admin server function / API route enforces `isAdmin(userId)` itself. A comment saying "the admin page is gated client-side" is a bug, not a justification.

**Why:** Partner/referral/regular users all saw the Admin nav entry and a fabricated token rendered the admin shell. Separately, the old `/admin` page component had no `<Outlet />`, so every `admin.*` child URL silently rendered the overview.

**Traps**
- A TanStack route component without `<Outlet />` swallows all child routes — children compile, the router matches them, the parent's UI renders anyway. Check for `<Outlet />` before debugging a child page "not loading".
- Clearing the entrance marker inside the passcode form's success callback races the provider's re-check (boundary sees `isAdmin=false` + no marker → redirects before the verified answer lands). Clear it on the verified-admin transition instead.
- The provider's admin check must re-run on auth changes (key the effect on the auth user id + loading), or a user signing in mid-session with `next=/admin` is treated as non-admin until reload.
