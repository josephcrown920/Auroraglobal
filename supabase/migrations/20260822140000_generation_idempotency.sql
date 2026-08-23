-- Generation-level idempotency: prevents one logical user action (a single
-- "Generate" click) from creating multiple paid generations because of a
-- double click, a client-side network retry, or an ambiguous provider
-- timeout followed by a retry.
--
-- How it is used (see src/lib/generate-core.server.ts):
--   1. Before reserving credits, the caller tries to INSERT a 'pending' row
--      keyed by (user_id, idempotency_key). Only one concurrent request can
--      win that insert (primary key conflict fences the rest).
--   2. The losing request(s) read the existing row instead of reserving
--      credits or calling a provider:
--        - status = 'succeeded' -> replay the cached response (no new charge).
--        - status = 'pending'   -> reject as "already in progress" (no charge).
--        - status = 'failed'    -> the original attempt already released its
--          reservation; the caller deletes the stale row and reserves fresh.
--
-- This table only ever needs to be written by the server's service-role
-- client (the code path already goes through reserveOrchestrateRecord, which
-- runs entirely server-side). Ordinary users may read their own rows for
-- debugging/support, but never write directly — matching the api_logs /
-- gpu_workers.auth_token pattern: the real safeguard is "no grant at all"
-- for writes, not a permissive RLS policy.
create table if not exists public.generation_idempotency_keys (
  user_id uuid not null,
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  generation_id uuid references public.generations(id) on delete set null,
  response jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

create index if not exists generation_idempotency_keys_created_at_idx
  on public.generation_idempotency_keys (created_at);

alter table public.generation_idempotency_keys enable row level security;

drop policy if exists "select own idempotency keys" on public.generation_idempotency_keys;
create policy "select own idempotency keys" on public.generation_idempotency_keys
  for select using (auth.uid() = user_id);

revoke insert, update, delete on public.generation_idempotency_keys from anon, authenticated;
grant select on public.generation_idempotency_keys to authenticated;
grant all on public.generation_idempotency_keys to service_role;
