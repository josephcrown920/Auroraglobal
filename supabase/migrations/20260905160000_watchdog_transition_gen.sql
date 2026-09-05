-- Watchdog transition generations (code review follow-up, round 3).
--
-- The timestamp-fenced restore was still racy across a claim PAIR: pass A
-- claims the alert; pass B claims the recovery (which only writes
-- recovery_sent_at); A's send is rejected and its restore matches on
-- alert_sent_at, erasing an alert stamp whose outage B already closed.
--
-- Fix: a monotonically increasing transition_gen column. EVERY successful
-- claim (alert or recovery) bumps it and returns the new value as claim_gen;
-- restore requires transition_gen = p_claim_gen, so a stale restore from an
-- earlier claim era can never match once any later claim has landed.

alter table public.watchdog_state
  add column if not exists transition_gen bigint not null default 0;

create or replace function public.watchdog_claim_transition(
  p_subsystem text,
  p_kind      text,        -- 'alert' | 'recovery'
  p_now       timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  prev_alert    timestamptz;
  prev_recovery timestamptz;
  claimed       boolean := false;
  new_gen       bigint;
begin
  if p_kind not in ('alert', 'recovery') then
    raise exception 'watchdog_claim_transition: invalid kind %', p_kind;
  end if;

  select alert_sent_at, recovery_sent_at
    into prev_alert, prev_recovery
    from public.watchdog_state
   where subsystem = p_subsystem
   for update;

  if not found then
    return jsonb_build_object('claimed', false);
  end if;

  if p_kind = 'alert' then
    -- Claim only when no outage is currently open (never alerted, or the
    -- last alert was already closed by a recovery).
    if prev_alert is null or (prev_recovery is not null and prev_recovery >= prev_alert) then
      update public.watchdog_state
         set alert_sent_at = p_now,
             transition_gen = watchdog_state.transition_gen + 1,
             updated_at = p_now
       where subsystem = p_subsystem
      returning transition_gen into new_gen;
      claimed := true;
    end if;
  else
    -- Claim only when an outage is open (alerted and not yet recovered).
    if prev_alert is not null and (prev_recovery is null or prev_recovery < prev_alert) then
      update public.watchdog_state
         set recovery_sent_at = p_now,
             transition_gen = watchdog_state.transition_gen + 1,
             updated_at = p_now
       where subsystem = p_subsystem
      returning transition_gen into new_gen;
      claimed := true;
    end if;
  end if;

  return jsonb_build_object(
    'claimed', claimed,
    'claim_gen', new_gen,
    'prev_alert_sent_at', prev_alert,
    'prev_recovery_sent_at', prev_recovery
  );
end;
$$;

-- CREATE OR REPLACE kept the signature, so the service_role grant and PUBLIC
-- revoke carry over — re-assert them anyway for safety.
revoke all on function public.watchdog_claim_transition(text, text, timestamptz) from public;
revoke all on function public.watchdog_claim_transition(text, text, timestamptz) from anon;
revoke all on function public.watchdog_claim_transition(text, text, timestamptz) from authenticated;
grant execute on function public.watchdog_claim_transition(text, text, timestamptz) to service_role;

drop function public.watchdog_restore_transition(text, text, timestamptz, timestamptz, timestamptz);

create or replace function public.watchdog_restore_transition(
  p_subsystem     text,
  p_kind          text,        -- 'alert' | 'recovery'
  p_claim_gen     bigint,      -- the transition generation THIS attempt claimed
  p_prev_alert    timestamptz,
  p_prev_recovery timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  restored boolean := false;
begin
  -- Fence on the claim generation: if ANY claim (alert or recovery) landed
  -- after ours, our era is over and the restore must be a no-op.
  if p_kind = 'alert' then
    update public.watchdog_state
       set alert_sent_at = p_prev_alert, updated_at = now()
     where subsystem = p_subsystem
       and transition_gen = p_claim_gen;
    restored := found;
  elsif p_kind = 'recovery' then
    update public.watchdog_state
       set recovery_sent_at = p_prev_recovery, updated_at = now()
     where subsystem = p_subsystem
       and transition_gen = p_claim_gen;
    restored := found;
  else
    raise exception 'watchdog_restore_transition: invalid kind %', p_kind;
  end if;
  return jsonb_build_object('restored', restored);
end;
$$;

revoke all on function public.watchdog_restore_transition(text, text, bigint, timestamptz, timestamptz) from public;
revoke all on function public.watchdog_restore_transition(text, text, bigint, timestamptz, timestamptz) from anon;
revoke all on function public.watchdog_restore_transition(text, text, bigint, timestamptz, timestamptz) from authenticated;
grant execute on function public.watchdog_restore_transition(text, text, bigint, timestamptz, timestamptz) to service_role;
