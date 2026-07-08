-- Aurora Video Agent: persistent per-user chat + permanent memory.
-- agent_chat_messages: full conversation history (user + assistant turns);
-- assistant turns may carry a structured shot plan (jsonb) produced server-side.
-- agent_user_memory: one row per user — the agent's distilled long-term memory
-- (style preferences, recurring characters, past projects). Survives chat clears.

create table if not exists public.agent_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  plan jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_chat_messages_user_created_idx
  on public.agent_chat_messages (user_id, created_at desc);

grant select, insert, update, delete on public.agent_chat_messages to authenticated;
grant all on public.agent_chat_messages to service_role;

alter table public.agent_chat_messages enable row level security;

drop policy if exists "agent_chat_messages_select_own" on public.agent_chat_messages;
create policy "agent_chat_messages_select_own" on public.agent_chat_messages
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "agent_chat_messages_insert_own" on public.agent_chat_messages;
create policy "agent_chat_messages_insert_own" on public.agent_chat_messages
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "agent_chat_messages_delete_own" on public.agent_chat_messages;
create policy "agent_chat_messages_delete_own" on public.agent_chat_messages
  for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.agent_user_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  memory text not null default '',
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.agent_user_memory to authenticated;
grant all on public.agent_user_memory to service_role;

alter table public.agent_user_memory enable row level security;

drop policy if exists "agent_user_memory_select_own" on public.agent_user_memory;
create policy "agent_user_memory_select_own" on public.agent_user_memory
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "agent_user_memory_insert_own" on public.agent_user_memory;
create policy "agent_user_memory_insert_own" on public.agent_user_memory
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "agent_user_memory_update_own" on public.agent_user_memory;
create policy "agent_user_memory_update_own" on public.agent_user_memory
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "agent_user_memory_delete_own" on public.agent_user_memory;
create policy "agent_user_memory_delete_own" on public.agent_user_memory
  for delete to authenticated using (auth.uid() = user_id);
