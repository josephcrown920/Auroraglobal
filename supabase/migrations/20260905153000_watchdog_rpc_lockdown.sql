-- Watchdog RPC lockdown + fenced restore (code review follow-up).
--
-- 1. PostgreSQL grants EXECUTE on new functions to PUBLIC by default, and the
--    PostgREST roles (anon/authenticated/service_role) INHERIT it — revoking
--    from anon/authenticated alone leaves the security-definer RPCs callable
--    by anyone with the anon key. Revoke PUBLIC and grant service_role
--    explicitly.
-- 2. watchdog_restore_transition is replaced with an ownership-fenced version:
--    a failed email send may only roll back its OWN claim (the row must still
--    hold the exact timestamp that claim wrote). A newer claim by another pass
--    can no longer be erased by a stale restore.

revoke all on function public.watchdog_record_state(text, text, text, boolean, timestamptz) from public;
revoke all on function public.watchdog_claim_transition(text, text, timestamptz) from public;
grant execute on function public.watchdog_record_state(text, text, text, boolean, timestamptz) to service_role;
grant execute on function public.watchdog_claim_transition(text, text, timestamptz) to service_role;

drop function public.watchdog_restore_transition(text, timestamptz, timestamptz);

create or replace function public.watchdog_restore_transition(
  p_subsystem        text,
  p_kind             text,        -- 'alert' | 'recovery'
  p_claimed_at       timestamptz, -- the timestamp THIS delivery attempt claimed
  p_prev_alert       timestamptz,
  p_prev_recovery    timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  restored boolean := false;
begin
  if p_kind = 'alert' then
    -- Fence: restore only if our claimed stamp is still the current one.
    -- A concurrent pass that validly claimed a later transition wins.
    update public.watchdog_state
       set alert_sent_at = p_prev_alert, updated_at = now()
     where subsystem = p_subsystem
       and alert_sent_at = p_claimed_at;
    restored := found;
  elsif p_kind = 'recovery' then
    update public.watchdog_state
       set recovery_sent_at = p_prev_recovery, updated_at = now()
     where subsystem = p_subsystem
       and recovery_sent_at = p_claimed_at;
    restored := found;
  else
    raise exception 'watchdog_restore_transition: invalid kind %', p_kind;
  end if;
  return jsonb_build_object('restored', restored);
end;
$$;

revoke all on function public.watchdog_restore_transition(text, text, timestamptz, timestamptz, timestamptz) from public;
revoke all on function public.watchdog_restore_transition(text, text, timestamptz, timestamptz, timestamptz) from anon;
revoke all on function public.watchdog_restore_transition(text, text, timestamptz, timestamptz, timestamptz) from authenticated;
grant execute on function public.watchdog_restore_transition(text, text, timestamptz, timestamptz, timestamptz) to service_role;
