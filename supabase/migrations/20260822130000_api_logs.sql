-- Task #374 — API observability: a durable log of every request made to
-- src/routes/api/** so operators can see traffic, latency, and error rate
-- per endpoint from an Admin dashboard instead of grepping workflow logs.
--
-- Written by the server's service-role client only (see
-- src/lib/api-logger.server.ts). No RLS policy is defined, and RLS is
-- enabled + all grants revoked from anon/authenticated, so the anon and
-- authenticated Postgres roles have zero access — only the service role
-- (which bypasses RLS entirely) can read or write this table. This
-- matches the pattern used by gpu_workers.auth_token: the real safeguard
-- is "no grant at all", not a permissive RLS policy.

create table if not exists public.api_logs (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  method text not null,
  status smallint not null,
  response_time_ms integer not null,
  ip text,
  user_agent text,
  source text not null check (source in ('real', 'bot', 'internal')),
  created_at timestamptz not null default now()
);

create index if not exists api_logs_created_at_idx on public.api_logs (created_at desc);
create index if not exists api_logs_endpoint_idx on public.api_logs (endpoint);
create index if not exists api_logs_source_idx on public.api_logs (source);

alter table public.api_logs enable row level security;

revoke all on public.api_logs from anon, authenticated;
-- Bypassing RLS (service_role's default behaviour) does not itself grant
-- table privileges — Postgres still checks GRANTs first. Without this, the
-- logger's insert and the admin dashboard's select both fail with
-- "permission denied for table api_logs", silently disabling observability.
grant all on public.api_logs to service_role;
