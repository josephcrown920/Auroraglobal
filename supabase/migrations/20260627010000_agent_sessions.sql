-- Aurora Agent: director–critic sessions + per-shot render linkage (Task #21)
-- Persists conversational agent sessions (brief, refined plan, director/critic
-- iteration history, messages) so plans are resumable, and links per-shot
-- renders back to the session that produced them.

create table if not exists public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  brief text not null default '',
  plan jsonb not null default '{}'::jsonb,
  iterations jsonb not null default '[]'::jsonb,
  messages jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_sessions_user_updated_idx
  on public.agent_sessions (user_id, updated_at desc);

grant select, insert, update, delete on public.agent_sessions to authenticated;
grant all on public.agent_sessions to service_role;

alter table public.agent_sessions enable row level security;

drop policy if exists "agent_sessions_select_own" on public.agent_sessions;
create policy "agent_sessions_select_own" on public.agent_sessions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "agent_sessions_insert_own" on public.agent_sessions;
create policy "agent_sessions_insert_own" on public.agent_sessions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "agent_sessions_update_own" on public.agent_sessions;
create policy "agent_sessions_update_own" on public.agent_sessions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "agent_sessions_delete_own" on public.agent_sessions;
create policy "agent_sessions_delete_own" on public.agent_sessions
  for delete to authenticated using (auth.uid() = user_id);

-- Link per-shot renders back to the agent session + shot that produced them.
-- Relational (not just nested JSON) so concurrent shot renders never overwrite
-- each other and status is derivable by querying generations for the session.
alter table public.generations
  add column if not exists session_id uuid references public.agent_sessions(id) on delete set null;
alter table public.generations
  add column if not exists agent_shot_id text;

create index if not exists generations_session_shot_idx
  on public.generations (session_id, agent_shot_id);
