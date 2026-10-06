alter table public.generations
  add column if not exists preview_fingerprint text;

alter table public.edit_sessions
  add column if not exists source_audio_path text;

create or replace function public.create_motion_generation_and_reserve(
  _user uuid,
  _prompt text,
  _amount int,
  _payload jsonb
) returns table (job_id uuid, generation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Serialize motion admission per user. The generation/job insert performed
  -- below occurs in this same transaction, so concurrent requests cannot both
  -- observe a free slot. Two slots correspond to wide + close-up.
  perform pg_advisory_xact_lock(hashtextextended(_user::text || ':motion', 0));
  if (
    select count(*)
    from public.jobs
    where user_id = _user
      and kind = 'motion'
      and status in ('queued', 'pending', 'processing', 'finalizing')
  ) >= 2 then
    raise exception 'motion_enqueue_limit';
  end if;

  return query
    select r.job_id, r.generation_id
    from public.create_generation_and_reserve(
      _user,
      'motion',
      _prompt,
      _amount,
      _payload
    ) r;
end;
$$;

revoke all on function public.create_motion_generation_and_reserve(uuid, text, int, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_motion_generation_and_reserve(uuid, text, int, jsonb)
  to service_role;