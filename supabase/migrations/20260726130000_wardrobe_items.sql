-- wardrobe_items: persists outfit/look references uploaded by users so they can
-- pick from a saved wardrobe without re-uploading each session.
-- storage_path is a relative path inside the `studio` bucket (signed at read-time).

create table if not exists wardrobe_items (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  storage_path text       not null,
  label       text        not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists wardrobe_items_user_created
  on wardrobe_items (user_id, created_at desc);

alter table wardrobe_items enable row level security;

create policy "users own their wardrobe"
  on wardrobe_items for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Service role bypasses RLS so server functions can do ownership-checked ops.
