-- user_avatar_shots: persists avatar shot results (image/video) for the Shots tab.
-- Results are downloaded from the provider CDN and uploaded to the studio bucket,
-- then the storage_path is stored here so the signed URL survives indefinitely.

create table if not exists user_avatar_shots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  engine text not null,
  kind text not null check (kind in ('image', 'video')),
  prompt text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists user_avatar_shots_user_created
  on user_avatar_shots (user_id, created_at desc);

alter table user_avatar_shots enable row level security;

create policy "users own their shots"
  on user_avatar_shots for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Service role bypasses RLS so server functions can do ownership-checked ops.
