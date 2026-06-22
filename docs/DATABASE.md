# Database

Aurora uses Lovable Cloud (Supabase Postgres). All schema changes go through SQL migrations in `supabase/migrations/`. Every public-schema table has RLS enabled and explicit `GRANT`s.

## Conventions

- **Roles** live in `user_roles` (never on `profiles`). Checked via `public.has_role(uuid, app_role)` (SECURITY DEFINER).
- **Credits** are mutated only via `public.grant_credits()` / `public.deduct_credits()` (SECURITY DEFINER). Direct updates to `profiles.credits` are blocked by RLS.
- **Auth user signups** trigger `public.handle_new_user()` → creates a profile with 5 signup-bonus credits and a `credit_ledger` entry. Trigger is wired on `auth.users` (managed by the integration — do not edit `auth.*` directly).
- Server code uses three Supabase clients (see `src/integrations/supabase/`):
  - `client.ts` — browser, publishable key, RLS applies
  - `auth-middleware.ts` — server fn middleware, user-scoped, RLS applies
  - `client.server.ts` — admin, service role, **bypasses RLS** (webhooks only)

## Tables

| Table | Purpose | Write access |
|---|---|---|
| `profiles` | User profile, plan, credit balance | self insert/update (credits/plan locked) |
| `user_roles` | Role assignment (admin, etc.) | service role only |
| `credit_ledger` | Immutable credit history | via `grant_credits` / `deduct_credits` |
| `payments` | Paystack payment records | webhook (service role) |
| `generations` | Image / video / lipsync / upscale outputs | self |
| `lipsync_jobs` | Sync.so lip-sync jobs | self |
| `workflows` | Saved canvas graphs | self; public flag for sharing |
| `gpu_workers` | Registered Inference.ai/RunPod workers | admin |
| `worker_jobs` | Worker job log | admin read; server insert |
| `provider_logs` | Per-call provider latency/cost/error | admin read; server insert |
| `events` | Analytics events | anyone insert; admin read |
| `leads` | Landing-page email captures | anyone insert; admin read |
| `contact_messages` | Contact form | anyone insert (validated); admin manage |
| `legal_acceptances` | TOS/Privacy acceptance log | self insert |
| `affiliates` | Affiliate program enrollments | self read/update (rates locked) |
| `affiliate_events` | Click / conversion events | validated public insert |
| `gift_cards` | Gift credit codes | admin only |

Full column lists, RLS policies, and grants are in `supabase/migrations/`.

## Database functions

| Function | Description |
|---|---|
| `has_role(_user uuid, _role app_role) → bool` | RLS-safe role check (SECURITY DEFINER) |
| `grant_credits(_user, _amount, _reason, _ref)` | Add credits + ledger entry; bumps `lifetime_credits_purchased` if `reason='purchase'` |
| `deduct_credits(_user, _amount, _reason, _ref) → bool` | Atomic deduct with balance check |
| `handle_new_user()` | Trigger: signup bonus on new auth user |
| `touch_updated_at()` | Trigger helper |

## Storage

| Bucket | Public | Contents |
|---|---|---|
| `studio` | yes | Uploaded reference images, generated outputs |

## Realtime

Not currently enabled on any table. To enable for live job updates, add the table to `supabase_realtime` publication via migration.

## Making schema changes

1. Use the `supabase--migration` tool — never `psql` for DDL.
2. For every new `public` table include in the same migration:
   ```sql
   CREATE TABLE public.foo (...);
   GRANT SELECT, INSERT, UPDATE, DELETE ON public.foo TO authenticated;
   GRANT ALL ON public.foo TO service_role;
   ALTER TABLE public.foo ENABLE ROW LEVEL SECURITY;
   CREATE POLICY ... ON public.foo ...;
   ```
3. Use **validation triggers**, not `CHECK` constraints, for time-based or mutable rules.
4. Data inserts/updates use `supabase--insert`, not migrations.

## Linting

Run the Supabase linter (`supabase--linter`) after schema changes. It will catch missing RLS, overly permissive policies, and missing grants.
