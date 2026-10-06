-- Single-runner lease + retry-overflow counter for the Promotion daily sweep.
--
-- lease_owner / lease_expires: a cron invocation claims the day with an
-- atomic conditional UPDATE (only an absent/expired lease can be taken) and
-- every checkpoint write is scoped to the lease holder, so two overlapping
-- runners can never regress each other's cursors.
-- retry_overflow: failures beyond the retry-list cap are counted and surfaced
-- (they are retried by the next day's fresh checkpoint), never silently dropped.

alter table public.promotion_sweep_state
  add column lease_owner text,
  add column lease_expires timestamptz,
  add column retry_overflow integer not null default 0;
