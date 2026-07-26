-- AI Video Editor: persistent edit sessions
create table if not exists edit_sessions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  title         text        not null default 'Untitled Edit',
  clip_list     jsonb       not null default '[]'::jsonb,
  chat_history  jsonb       not null default '[]'::jsonb,
  style         text        not null default 'hype',
  music_track_id text,
  status        text        not null default 'draft'
                            check (status in ('draft', 'exporting', 'done')),
  result_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table edit_sessions enable row level security;

create policy "edit_sessions: owner full access"
  on edit_sessions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh on every write
create or replace function _edit_sessions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger edit_sessions_updated_at
  before update on edit_sessions
  for each row execute function _edit_sessions_updated_at();

-- Index for listing sessions by user
create index if not exists edit_sessions_user_id_idx
  on edit_sessions(user_id, created_at desc);
