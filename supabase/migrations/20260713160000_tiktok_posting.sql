-- Task #285: TikTok Content Posting API integration
-- Stores OAuth tokens per user and per-generation post status.

-- ── tiktok_accounts ─────────────────────────────────────────────────────────
-- One row per user, updated on every token refresh.
create table tiktok_accounts (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null unique references profiles(user_id) on delete cascade,
  open_id            text        not null,          -- TikTok's stable user identifier
  username           text,
  display_name       text,
  avatar_url         text,
  access_token       text        not null,
  refresh_token      text        not null,
  token_expires_at   timestamptz not null,
  refresh_expires_at timestamptz not null,
  scope              text,
  -- Ephemeral CSRF state written during OAuth initiation; cleared on completion.
  oauth_state        text,
  oauth_state_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table tiktok_accounts enable row level security;
-- Users can read and manage only their own connected account.
create policy "own tiktok account" on tiktok_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Service role (server functions) also needs unrestricted access.
-- (Service role bypasses RLS automatically — no extra policy needed.)

-- ── tiktok_posts ─────────────────────────────────────────────────────────────
-- One row per "Post to TikTok" click, tracking publish status.
create table tiktok_posts (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references profiles(user_id) on delete cascade,
  -- Which generation was posted. Nullable: could be a direct URL post.
  generation_id  text,
  video_url      text        not null,
  title          text,
  publish_id     text,        -- TikTok's publish_id returned from the post API
  status         text        not null default 'pending',
  -- TikTok status values: pending → processing_upload → processing_download →
  -- processing_media_edit → processing_stabilize → publish_complete / failed
  error_msg      text,
  posted_at      timestamptz, -- set when status = publish_complete
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table tiktok_posts enable row level security;
create policy "own tiktok posts" on tiktok_posts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── updated_at triggers ──────────────────────────────────────────────────────
create or replace function set_tiktok_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger tiktok_accounts_updated_at
  before update on tiktok_accounts
  for each row execute function set_tiktok_updated_at();

create trigger tiktok_posts_updated_at
  before update on tiktok_posts
  for each row execute function set_tiktok_updated_at();
