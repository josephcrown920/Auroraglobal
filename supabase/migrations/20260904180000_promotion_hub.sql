-- Task #840: Promotion Hub — artist platform links + daily stat snapshots.
--
-- artist_platform_links holds one row per (user, platform) for the five
-- link-based platforms. TikTok identity stays in tiktok_accounts (OAuth) but
-- its daily numbers flow into the same snapshots table. All writes happen via
-- the service role (server functions + cron); users get read-only RLS.

-- ── artist_platform_links ────────────────────────────────────────────────────
create table if not exists public.artist_platform_links (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users(id) on delete cascade,
  platform       text        not null check (platform in (
                   'spotify', 'apple_music', 'audiomack', 'boomplay', 'youtube'
                 )),
  external_id    text,                        -- platform artist/channel id (nullable for Boomplay)
  profile_url    text        not null,
  display_name   text,
  image_url      text,
  detail         jsonb       not null default '{}'::jsonb,  -- latest top tracks / videos / releases payload
  last_synced_at timestamptz,                 -- also the manual-sync cooldown clock
  last_error     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, platform)
);
create index if not exists idx_artist_platform_links_user_id
  on public.artist_platform_links(user_id);

alter table public.artist_platform_links enable row level security;
create policy "artist_platform_links_select_own" on public.artist_platform_links
  for select using (auth.uid() = user_id);
create trigger artist_platform_links_touch
  before update on public.artist_platform_links
  for each row execute function public.touch_updated_at();

revoke all on public.artist_platform_links from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.artist_platform_links from authenticated;
grant all on public.artist_platform_links to service_role;

-- ── artist_platform_snapshots ────────────────────────────────────────────────
-- One row per (user, platform, UTC day); re-syncs within a day overwrite the
-- day's row so growth charts never double-count.
create table if not exists public.artist_platform_snapshots (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  platform   text        not null check (platform in (
               'spotify', 'apple_music', 'audiomack', 'boomplay', 'youtube', 'tiktok'
             )),
  day        date        not null,
  metrics    jsonb       not null default '{}'::jsonb,  -- headline metrics for the day
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform, day)
);
create index if not exists idx_artist_platform_snapshots_user_platform_day
  on public.artist_platform_snapshots(user_id, platform, day desc);

alter table public.artist_platform_snapshots enable row level security;
create policy "artist_platform_snapshots_select_own" on public.artist_platform_snapshots
  for select using (auth.uid() = user_id);
create trigger artist_platform_snapshots_touch
  before update on public.artist_platform_snapshots
  for each row execute function public.touch_updated_at();

revoke all on public.artist_platform_snapshots from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.artist_platform_snapshots from authenticated;
grant all on public.artist_platform_snapshots to service_role;

-- ── TikTok OAuth return path ─────────────────────────────────────────────────
-- Where to send the user after the OAuth callback ("/settings" default,
-- "/promotion" when the flow started on the Promotion page).
alter table public.tiktok_accounts
  add column if not exists oauth_return_to text;
