-- DB-time, status-aware lease claim. Service role only: browser clients cannot
-- rotate operation fencing tokens or reclaim work.
create or replace function public.claim_multishot_operation(
  _shot_id uuid,
  _user_id uuid,
  _kind text,
  _expected_revision integer,
  _expected_status text,
  _expected_token uuid,
  _new_token uuid,
  _lease_seconds integer default 900
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _claimed_count integer := 0;
begin
  if _kind not in ('preview', 'temporal', 'final') then
    raise exception 'invalid multishot operation kind';
  end if;
  if _lease_seconds < 60 or _lease_seconds > 1800 then
    raise exception 'invalid multishot lease duration';
  end if;

  if _kind = 'preview' then
    update public.multishot_shots
       set preview_status = 'processing',
           preview_operation_token = _new_token,
           preview_lease_until = statement_timestamp() + make_interval(secs => _lease_seconds),
           preview_error = null
     where id = _shot_id and user_id = _user_id and revision = _expected_revision
       and preview_status = _expected_status
       and (
         _expected_status <> 'processing'
         or (
           preview_lease_until <= statement_timestamp()
           and preview_operation_token is not distinct from _expected_token
         )
       );
  elsif _kind = 'temporal' then
    update public.multishot_shots
       set temporal_status = 'processing',
           temporal_operation_token = _new_token,
           temporal_lease_until = statement_timestamp() + make_interval(secs => _lease_seconds),
           temporal_error = null
     where id = _shot_id and user_id = _user_id and revision = _expected_revision
       and temporal_status = _expected_status
       and (
         _expected_status <> 'processing'
         or (
           temporal_lease_until <= statement_timestamp()
           and temporal_operation_token is not distinct from _expected_token
         )
       );
  else
    update public.multishot_shots
       set final_status = 'processing',
           final_operation_token = _new_token,
           final_lease_until = statement_timestamp() + make_interval(secs => _lease_seconds),
           final_error = null
     where id = _shot_id and user_id = _user_id and revision = _expected_revision
       and final_status = _expected_status
       and (
         _expected_status <> 'processing'
         or (
           final_lease_until <= statement_timestamp()
           and final_operation_token is not distinct from _expected_token
         )
       );
  end if;

  get diagnostics _claimed_count = row_count;
  return _claimed_count > 0;
end;
$$;

revoke all on function public.claim_multishot_operation(
  uuid, uuid, text, integer, text, uuid, uuid, integer
) from public, anon, authenticated;
grant execute on function public.claim_multishot_operation(
  uuid, uuid, text, integer, text, uuid, uuid, integer
) to service_role;