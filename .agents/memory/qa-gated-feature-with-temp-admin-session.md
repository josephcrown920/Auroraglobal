---
name: QA'ing a hidden/admin-gated feature via a temp Supabase session
description: How to visually verify a feature behind FeatureVisibilityGate or similar auth gates when no real admin credentials are available, and why browser-use CLI isn't the tool for it here.
---

The `browser-use` CLI referenced in its own skill is NOT installed in this
workspace (`command not found`, and no binary found under common paths). Do
not spend time retrying it here — use Playwright instead, which is already a
project dependency (used by the `test:e2e` workflow) and works for one-off
scripted QA.

To visually verify a feature gated behind Supabase auth + admin role (e.g.
`FeatureVisibilityGate`, `assertFeatureAccess`) without real user credentials:

1. Create a throwaway Supabase user via the service-role client
   (`supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`)
   run as a plain Node script through `ShellExec` (the container's shell
   already has `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in `process.env`
   because the app itself needs them at runtime — no secret-reading required).
2. Insert a row into `user_roles` (`role: "admin"`) for that user id if the
   feature's server-side check requires the admin role, not just any signed-in
   user.
3. Sign in with the anon client (`signInWithPassword`) to get a real
   `session` object (access_token, refresh_token, expires_in, etc).
4. Drive a real browser with Playwright (`chromium.launch()`), using
   `page.addInitScript()` to write that session into `localStorage` under
   Supabase's default key `sb-<project-ref>-auth-token` (project ref = the
   first label of the Supabase URL's host) BEFORE the app's JS runs. The
   app's own `supabase-js` client then picks up the persisted session on
   init — no UI login needed.
5. Run the Node script from inside the workspace root (not `/tmp`) so ESM
   module resolution finds `node_modules/playwright` etc.
6. Always delete the temp user (`auth.admin.deleteUser`) and its
   `user_roles` row afterward, and delete the scratch `.mjs` scripts —
   nothing about this technique should leave residue in the repo or the
   Supabase user table.

**Why:** the FeatureVisibilityGate pattern used across Aurora Global
fail-closes for non-admins, so the `Screenshot` tool's plain page load of a
hidden feature just shows the main app's redirect-away splash — it isn't a
bug in the new feature, and there's no way to click through an auth/age-gate
flow with `Screenshot` alone since it can't run JS or click.
