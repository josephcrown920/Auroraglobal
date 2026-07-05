-- Aurora MCP: per-user avatar (persona) records.
-- Avatars are named personas a user can attach to generations. LoRA fields are
-- optional and only populated when external training (HeyGen / Sync.so) is
-- configured; otherwise an avatar is a plain, immediately-usable record.

create table if not exists public.avatars (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  handle                text not null,
  lora_id               text,
  sync_lora_id          text,
  trigger_word          text default 'style',
  style                 text default 'general',
  preview_url           text,
  training_status       text not null default 'completed'
                          check (training_status in ('pending', 'in_progress', 'completed', 'failed')),
  training_submitted_at timestamptz default now(),
  training_completed_at timestamptz,
  training_error        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint avatars_name_not_empty check (char_length(name) > 0),
  constraint avatars_user_name_unique unique (user_id, name),
  constraint avatars_user_handle_unique unique (user_id, handle)
);

create index if not exists idx_avatars_user_id   on public.avatars(user_id);
create index if not exists idx_avatars_user_name on public.avatars(user_id, name);

alter table public.avatars enable row level security;

create policy "avatars_select_own" on public.avatars
  for select using (auth.uid() = user_id);
create policy "avatars_insert_own" on public.avatars
  for insert with check (auth.uid() = user_id);
create policy "avatars_update_own" on public.avatars
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "avatars_delete_own" on public.avatars
  for delete using (auth.uid() = user_id);

-- Reuse the project's shared updated_at trigger function.
create trigger avatars_touch
  before update on public.avatars
  for each row execute function public.touch_updated_at();
