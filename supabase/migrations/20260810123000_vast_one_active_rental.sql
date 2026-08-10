-- Concurrency guard for Aurora-created Vast rentals: at most ONE non-adopted
-- managed instance may be in an active state at a time. Provisioning inserts
-- a reservation row BEFORE calling Vast, so two racing CLI commands collide
-- here instead of both renting billable instances.
create unique index if not exists vast_managed_one_active_rental_idx
  on public.vast_managed_instances ((true))
  where state in ('renting','running','stopped') and adopted = false;
