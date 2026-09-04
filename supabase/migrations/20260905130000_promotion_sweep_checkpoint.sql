-- Resumable daily Promotion sweep.
--
-- The old offset-based walk restarted from row zero on every retry, so a
-- sweep that hit its page guard (or the daemon's curl timeout) permanently
-- starved all later rows. This migration adds:
--   1. a stable keyset cursor column on artist_platform_links (identity
--      backfills existing rows automatically), and
--   2. a durable per-UTC-day checkpoint table so each cron invocation
--      resumes exactly where the previous one stopped, plus a persisted
--      retry list that gets ONE same-day retry pass before failures are
--      terminal for the day.

alter table public.artist_platform_links
  add column sweep_seq bigint generated always as identity;

create index artist_platform_links_sweep_seq_idx
  on public.artist_platform_links (sweep_seq);

-- Identity columns use an internal sequence; service_role writes rows.
grant usage, select on sequence public.artist_platform_links_sweep_seq_seq to service_role;

create table public.promotion_sweep_state (
  day text primary key,
  link_cursor bigint not null default 0,
  tiktok_cursor text not null default '',
  links_done boolean not null default false,
  tiktok_done boolean not null default false,
  retried_today boolean not null default false,
  retry jsonb not null default '[]'::jsonb,
  synced integer not null default 0,
  failed integer not null default 0,
  skipped integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Service-role only: the checkpoint is internal cron bookkeeping.
alter table public.promotion_sweep_state enable row level security;
revoke all on table public.promotion_sweep_state from anon, authenticated;
grant select, insert, update, delete on public.promotion_sweep_state to service_role;
