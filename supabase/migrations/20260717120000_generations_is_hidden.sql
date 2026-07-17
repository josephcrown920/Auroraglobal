-- Allow users to hide generations from their gallery without deleting them.
-- is_hidden = true means the generation is suppressed from the default gallery view.
-- A dedicated index keeps the per-user hidden/visible queries fast.

alter table public.generations
  add column if not exists is_hidden boolean not null default false;

create index if not exists generations_hidden_idx
  on public.generations (user_id, is_hidden, created_at desc);
