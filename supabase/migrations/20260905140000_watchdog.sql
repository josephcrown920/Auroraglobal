-- System watchdog ("hound dog") state: one row per observed subsystem
-- (site, scheduler, queue, workers, providers, github_sync, build), plus an
-- append-only log of every auto-remediation the watchdog attempted.
--
-- Alert/dedup semantics mirror uptime_monitor_state: consecutive_failures
-- must cross a threshold before one alert email is sent per outage, and a
-- recovery email closes the outage (alert_sent_at / recovery_sent_at).

create table if not exists public.watchdog_state (
  subsystem            text primary key,
  status               text not null default 'unknown'
                       check (status in ('ok', 'degraded', 'down', 'unknown')),
  detail               text,
  consecutive_failures int not null default 0,
  last_check_at        timestamptz,
  last_ok_at           timestamptz,
  alert_sent_at        timestamptz,
  recovery_sent_at     timestamptz,
  -- Remediation cooldown bookkeeping: the watchdog claims a remediation slot
  -- with a conditional UPDATE on last_action_at so concurrent runs cannot
  -- double-fire the same fix.
  last_action          text,
  last_action_at       timestamptz,
  updated_at           timestamptz not null default now()
);

create table if not exists public.watchdog_actions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  subsystem    text not null,
  action       text not null,
  before_state jsonb,
  after_state  jsonb,
  result       text not null check (result in ('ok', 'failed', 'skipped'))
);

create index if not exists watchdog_actions_created_at_idx
  on public.watchdog_actions (created_at desc);

-- RLS: service-role only — the watchdog route uses supabaseAdmin.
alter table public.watchdog_state enable row level security;
alter table public.watchdog_actions enable row level security;
revoke all on public.watchdog_state from anon;
revoke all on public.watchdog_state from authenticated;
revoke all on public.watchdog_actions from anon;
revoke all on public.watchdog_actions from authenticated;
