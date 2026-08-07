-- generation_health_state: one row per GenerateKind, tracks consecutive
-- error counts and alert/recovery timestamps for the provider-health-check cron.
-- Used by the admin dashboard banner and by the cron to suppress duplicate alerts.

create table if not exists generation_health_state (
  kind                text        primary key,
  consecutive_ok      integer     not null default 0,
  consecutive_errors  integer     not null default 0,
  last_ok_at          timestamptz,
  alert_sent_at       timestamptz,
  recovery_sent_at    timestamptz,
  last_error_summary  text,
  last_check_at       timestamptz,
  updated_at          timestamptz not null default now()
);

-- Only the service role (server-side) should write this table.
-- Admins can read it via the service-role client.
alter table generation_health_state enable row level security;

-- No public read — server functions access via supabaseAdmin (bypasses RLS).
