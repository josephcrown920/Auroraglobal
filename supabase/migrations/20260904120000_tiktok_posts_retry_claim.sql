-- TikTok post retries: durable per-post attempt counter + an atomic claim RPC.
--
-- Retrying a failed TikTok post must be rate-limited server-side. The claim
-- is a single UPDATE whose WHERE clause enforces ownership, failed status,
-- a cooldown since the last attempt, and a maximum number of attempts —
-- Postgres takes the row lock while evaluating it, so concurrent retries of
-- the same post see zero rows and stop. retry_count makes the attempt cap
-- durable (each retry increments it inside the same statement).

alter table public.tiktok_posts
  add column if not exists retry_count integer not null default 0;

comment on column public.tiktok_posts.retry_count is
  'Number of retry attempts claimed via claim_tiktok_retry (the initial post is not counted).';

create or replace function public.claim_tiktok_retry(
  p_post_id uuid,
  p_user_id uuid,
  p_cooldown_ms integer,
  p_max_attempts integer
)
returns setof public.tiktok_posts
language sql
security definer
set search_path = public
as $$
  update public.tiktok_posts
  set status = 'pending',
      error_msg = null,
      publish_id = null,
      retry_count = retry_count + 1,
      updated_at = now()
  where id = p_post_id
    and user_id = p_user_id
    and status in ('failed', 'publish_from_creator_fail')
    and updated_at < now() - make_interval(secs => p_cooldown_ms / 1000.0)
    and retry_count < p_max_attempts
  returning *;
$$;

-- Service-role only: the server passes the authenticated caller's user id,
-- so this function must never be executable by anon/authenticated roles.
revoke all on function public.claim_tiktok_retry(uuid, uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_tiktok_retry(uuid, uuid, integer, integer) to service_role;
