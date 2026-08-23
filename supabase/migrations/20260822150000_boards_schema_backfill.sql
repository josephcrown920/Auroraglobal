-- Schema-drift backfill: public.boards, public.board_items, and
-- public.chat_threads exist on the live database (used by
-- src/lib/account-purge.server.ts for account-deletion cleanup, and by the
-- Directors Board feature referenced in prior work) but were never captured
-- in a migration file. A fresh database built from this migration history
-- alone would be missing all three tables. This migration documents the
-- live schema exactly (idempotent `create table if not exists`, matching
-- the live column set/defaults) so the migration history is a true source
-- of truth again. It intentionally does not add new constraints (e.g. a
-- user_id -> auth.users FK) beyond what is live today.
--
-- RLS lockdown for these tables is handled separately in
-- 20260822150100_lockdown_boards_render_jobs_rls.sql — this migration only
-- restores the missing table definitions.

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'Untitled Board',
  description text,
  thumbnail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boards_user_id_idx on public.boards (user_id);

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
  before update on public.boards
  for each row execute function public.set_updated_at();

create table if not exists public.board_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null,
  type text not null default 'image',
  prompt text,
  image_url text,
  source_url text,
  video_url text,
  metadata jsonb not null default '{}'::jsonb,
  node_id text,
  x double precision not null default 0,
  y double precision not null default 0,
  z_index integer not null default 0,
  width double precision,
  height double precision,
  created_at timestamptz not null default now()
);

create index if not exists board_items_board_id_idx on public.board_items (board_id);
create index if not exists board_items_user_id_idx on public.board_items (user_id);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references public.boards(id) on delete cascade,
  user_id uuid not null,
  title text not null default 'Canvas Chat',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_threads_board_id_idx on public.chat_threads (board_id);
create index if not exists chat_threads_user_id_idx on public.chat_threads (user_id);

drop trigger if exists chat_threads_set_updated_at on public.chat_threads;
create trigger chat_threads_set_updated_at
  before update on public.chat_threads
  for each row execute function public.set_updated_at();
