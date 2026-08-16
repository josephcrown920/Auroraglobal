-- Durable retry queue for account-deletion final sweeps.
--
-- /api/public/account-delete runs a post-auth final sweep (storage + rows) to
-- close the enumerate→delete race with in-flight work. If that sweep fails,
-- the account's login is already gone (auth user deleted) so the user cannot
-- retry — instead the failure is recorded here and the cron-driven
-- /api/public/deletion-sweep endpoint retries the purge until it succeeds.
--
-- Deliberately NO foreign key to auth.users: rows are only ever written for
-- users who have just been deleted, so an FK would reject every insert.
create table if not exists public.account_deletion_sweeps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.account_deletion_sweeps is
  'Durable cleanup queue: failed account-delete final sweeps, retried by the cron deletion-sweep endpoint until the purge completes. Service-role only.';

create index if not exists account_deletion_sweeps_pending_idx
  on public.account_deletion_sweeps (created_at)
  where status = 'pending';

-- Service-role only: RLS on with no policies + explicit revoke means neither
-- anon nor authenticated clients can read or write the queue.
alter table public.account_deletion_sweeps enable row level security;
revoke all on public.account_deletion_sweeps from anon, authenticated;
