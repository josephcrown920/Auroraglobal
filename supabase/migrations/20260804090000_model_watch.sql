-- Model Watch: automatic discovery of newly released AI models.
--
-- Two kinds of rows share the table:
--   watch_kind = 'catalog'      — models discovered in a provider's public
--                                 catalog (fal.ai search API, Replicate
--                                 collections). New arrivals are flagged
--                                 status='new' and emailed to the operator.
--   watch_kind = 'anticipated'  — specific ModelArk slugs we probe with an
--                                 uncharged invalid-payload request to learn
--                                 whether the account can call them yet
--                                 (availability: not_open → open transition
--                                 triggers an operator email).
--
-- RLS follows the ai_router_logs pattern: enabled, with anon/authenticated
-- fully revoked — all reads/writes go through service-role server functions.

create table if not exists public.model_watch (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,                       -- 'fal' | 'replicate' | 'modelark'
  model_id     text not null,                       -- provider-native model id/slug
  title        text,
  category     text,                                -- provider-reported category
  watch_kind   text not null default 'catalog',     -- 'catalog' | 'anticipated'
  availability text,                                -- anticipated only: 'open'|'not_open'|'not_found'|'error'
  status       text not null default 'new',         -- 'seeded'|'new'|'reviewed'|'ignored'
  meta         jsonb not null default '{}'::jsonb,
  first_seen   timestamptz not null default now(),
  last_checked timestamptz not null default now(),
  unique (provider, model_id)
);

create index if not exists model_watch_first_seen_idx
  on public.model_watch (first_seen desc);

create index if not exists model_watch_status_idx
  on public.model_watch (status);

alter table public.model_watch enable row level security;

revoke all on public.model_watch from anon;
revoke all on public.model_watch from authenticated;
