-- Lock down tiktok_accounts: it stores long-lived OAuth tokens
-- (access_token / refresh_token) as ordinary columns. The own-row RLS policy
-- plus authenticated table grants let any signed-in user SELECT their tokens
-- directly through the Supabase API — materially worse now that the grants
-- include Display API scopes (user.info.stats, video.list).
--
-- Every app read/write already goes through service-role server functions
-- (tiktok-posting.functions.ts, promotion sync), so direct table access is
-- revoked entirely. RLS stays enabled with zero policies: only the service
-- role (which bypasses RLS) can touch the table.

revoke all on table public.tiktok_accounts from anon, authenticated;

drop policy if exists "own tiktok account" on public.tiktok_accounts;
