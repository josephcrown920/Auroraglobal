-- Uptime monitor state: single row tracks consecutive failure count
-- for the production /api/health probe so alerts fire on repeated failures.
-- Also stores the last alert/recovery email timestamps to prevent spam.

create table if not exists public.uptime_monitor_state (
  id               text primary key default 'prod',
  consecutive_failures int not null default 0,
  last_check_at    timestamptz,
  last_ok_at       timestamptz,
  last_error       text,
  alert_sent_at    timestamptz,     -- when the outage-alert email was sent
  recovery_sent_at timestamptz,     -- when the recovery email was sent
  updated_at       timestamptz not null default now()
);

-- Seed the single canonical row so upsert never needs to insert.
insert into public.uptime_monitor_state (id)
  values ('prod')
  on conflict (id) do nothing;

-- RLS: service-role only — the route uses supabaseAdmin.
alter table public.uptime_monitor_state enable row level security;
revoke all on public.uptime_monitor_state from anon;
revoke all on public.uptime_monitor_state from authenticated;
