-- Watchdog atomic state transitions (code review follow-up).
--
-- The watchdog endpoint previously read watchdog_state, decided, emailed, and
-- stamped in separate non-conditional steps — two overlapping passes could
-- double-send the same alert/recovery or lose failure-count updates. These
-- service-role RPCs make the three state mutations atomic:
--
--   watchdog_record_state      — upsert with an atomic increment of
--                                consecutive_failures (no lost updates).
--   watchdog_claim_transition  — claim the right to send the alert/recovery
--                                email exactly once per outage (row lock).
--   watchdog_restore_transition— roll a claim back when email delivery fails,
--                                so the next pass retries instead of going
--                                permanently silent.
--
-- All are service-role only (revoked from anon/authenticated), matching the
-- watchdog_state / watchdog_actions tables.

create or replace function public.watchdog_record_state(
  p_subsystem text,
  p_status    text,
  p_detail    text,
  p_degraded  boolean,
  p_now       timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.watchdog_state (
    subsystem, status, detail, consecutive_failures, last_check_at, last_ok_at, updated_at
  ) values (
    p_subsystem,
    p_status,
    p_detail,
    case when p_degraded then 1 else 0 end,
    p_now,
    case when p_degraded then null else p_now end,
    p_now
  )
  on conflict (subsystem) do update set
    status               = p_status,
    detail               = p_detail,
    consecutive_failures = case when p_degraded
                                then watchdog_state.consecutive_failures + 1
                                else 0
                           end,
    last_check_at        = p_now,
    last_ok_at           = case when p_degraded
                                then watchdog_state.last_ok_at
                                else p_now
                           end,
    updated_at           = p_now;
end;
$$;

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
         set alert_sent_at = p_now, updated_at = p_now
       where subsystem = p_subsystem;
      claimed := true;
    end if;
  else
    -- Claim only when an outage is open (alerted and not yet recovered).
    if prev_alert is not null and (prev_recovery is null or prev_recovery < prev_alert) then
      update public.watchdog_state
         set recovery_sent_at = p_now, updated_at = p_now
       where subsystem = p_subsystem;
      claimed := true;
    end if;
  end if;

  return jsonb_build_object(
    'claimed', claimed,
    'prev_alert_sent_at', prev_alert,
    'prev_recovery_sent_at', prev_recovery
  );
end;
$$;

create or replace function public.watchdog_restore_transition(
  p_subsystem        text,
  p_alert_sent_at    timestamptz,
  p_recovery_sent_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.watchdog_state
     set alert_sent_at    = p_alert_sent_at,
         recovery_sent_at = p_recovery_sent_at,
         updated_at       = now()
   where subsystem = p_subsystem;
end;
$$;

revoke all on function public.watchdog_record_state(text, text, text, boolean, timestamptz) from anon;
revoke all on function public.watchdog_record_state(text, text, text, boolean, timestamptz) from authenticated;
revoke all on function public.watchdog_claim_transition(text, text, timestamptz) from anon;
revoke all on function public.watchdog_claim_transition(text, text, timestamptz) from authenticated;
revoke all on function public.watchdog_restore_transition(text, timestamptz, timestamptz) from anon;
revoke all on function public.watchdog_restore_transition(text, timestamptz, timestamptz) from authenticated;
