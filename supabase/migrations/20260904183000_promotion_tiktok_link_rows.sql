-- Task #840 follow-on: allow a TikTok row in artist_platform_links.
-- tiktok_accounts stays the OAuth identity source; the link row caches the
-- resolved profile (open_id, name, avatar) plus the latest top-videos detail
-- payload so the Promotion card renders without a live TikTok call.

alter table public.artist_platform_links
  drop constraint if exists artist_platform_links_platform_check;
alter table public.artist_platform_links
  add constraint artist_platform_links_platform_check
  check (platform in (
    'spotify', 'apple_music', 'audiomack', 'boomplay', 'youtube', 'tiktok'
  ));
