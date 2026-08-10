# Spin / TikTok Workflow Verification — Auth Guide

## Problem

`/spin` (and every private creator workflow) requires a valid Supabase
session. Browser-based verification runs had no reusable session and the app
exposes no guest access, so protected workflows could not be verified.

## Approved Mechanism — Passwordless QA Session

`scripts/lib/get-test-session.ts` exports `getTestSession()` which:

1. Looks up the QA test user (`qa-test@aurora-internal.test`) via the Supabase
   Admin API.
2. Calls `supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email })`
   and exchanges the returned `hashed_token` via `verifyOtp` — no password,
   no OTP email, no credentials in chat.
3. Returns `{ accessToken, userId, session }` where `session` is the
   **complete** Supabase session (access_token, refresh_token, expires_at,
   user). Browser injection needs the full object, not just the JWT.

The QA user is an ordinary creator account with normal RLS restrictions and
no admin privileges. The service-role key never leaves the server; the
returned token is a scoped user JWT with the default (~1 h) lifetime.
Never log or persist the token.

## What Is Verified (scripts/smoke-spin-e2e.ts)

The smoke calls the running dev server's server-function HTTP endpoints with
the same wire format the browser uses (seroval payload + crossjson response,
`x-tsr-serverFn` header). RPC ids are discovered at runtime from the
dev-server-transformed module, never hardcoded. Coverage, in order:

| Step | What | Proves |
|---|---|---|
| 2 | `getSpinOptions` over HTTP, **no** auth header | `requireSupabaseAuth` rejects unauthenticated calls |
| 3 | `getSpinOptions` over HTTP with QA bearer | middleware accepts the generated session |
| 4 | `spinThirty` over HTTP with a **not-owned** reference URL | zod input validation + `assertOwnedReferenceImage` reject **before any charge** (balance asserted unchanged) |
| 5 | `runSmokeSpinOne` direct invocation | render path only — deliberately bypasses auth/billing (covered by 2–4) |
| 6 | (`CONFIRM_SPEND=1`) real 30-post `spinThirty` batch over HTTP | full production path incl. credit charge |

Cleanup: studio uploads removed; the QA user's credit balance is restored to
its exact pre-run value in `finally`.

```bash
bun run scripts/smoke-spin-e2e.ts                 # steps 1-5, no spend
CONFIRM_SPEND=1 bun run scripts/smoke-spin-e2e.ts # + real 30-post batch
```

## Using the Session in a Browser Verification Run

The app's Supabase client (`src/integrations/supabase/client.ts`) uses the
default auth storage: localStorage key `sb-<project-ref>-auth-token`, where
`<project-ref>` is the subdomain of `SUPABASE_URL`
(e.g. `https://tpzmvbczwahxajujvnrq.supabase.co` → `tpzmvbczwahxajujvnrq`).

Seed the **entire session object** (Supabase JS requires refresh_token and
user; a bare access_token will not restore a session):

```typescript
import { getTestSession } from "../../scripts/lib/get-test-session";

const { session } = await getTestSession();
const projectRef = new URL(process.env.SUPABASE_URL!).hostname.split(".")[0];

// Playwright: seed before the app boots
await context.addInitScript(
  ([key, value]) => localStorage.setItem(key, value),
  [`sb-${projectRef}-auth-token`, JSON.stringify(session)],
);
await page.goto(`${BASE_URL}/spin`); // loads signed in as the QA user
```

Supabase JS reads that key on startup, validates/refreshes the token itself,
and the app behaves exactly as if the QA user had signed in at `/auth`.
Alternatively, after the app has booted, call
`window.supabase?.auth.setSession(session)` if a client handle is exposed —
the localStorage seed is the dependency-free option.

## Full 30-Post Identity Verification

1. `CONFIRM_SPEND=1 bun run scripts/smoke-spin-e2e.ts` submits the batch over
   the real HTTP path and prints the `jobId`.
2. Poll via the browser (`/spin` shows batch progress) or by calling
   `tickSpinJob`/`getSpinJob` over HTTP with the same bearer token until all
   30 variants reach `status = "done"`.
3. Open the 30 result URLs in a grid and visually confirm identity
   consistency across outfits/locations/angles. Flag any piece served by an
   identity-blind fallback provider (see provider logs).
