create table if not exists video_agent_messages (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  role        text        not null check (role in ('user', 'assistant')),
  content     text        not null,
  metadata    jsonb       default '{}'::jsonb,
  created_at  timestamptz default now() not null
);

create index if not exists idx_video_agent_messages_user
  on video_agent_messages(user_id, created_at asc);

alter table video_agent_messages enable row level security;

create policy "Users read own video agent messages"
  on video_agent_messages for select
  using (auth.uid() = user_id);
