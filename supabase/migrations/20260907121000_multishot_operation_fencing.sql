-- Additive safety fencing for the already-deployed Multishot schema.
alter table public.multishot_shots
  add column if not exists preview_operation_token uuid,
  add column if not exists preview_lease_until timestamptz,
  add column if not exists temporal_operation_token uuid,
  add column if not exists temporal_lease_until timestamptz,
  add column if not exists final_status text not null default 'idle'
    check (final_status in ('idle', 'processing', 'succeeded', 'failed')),
  add column if not exists final_operation_token uuid,
  add column if not exists final_lease_until timestamptz,
  add column if not exists final_error text;

create index if not exists multishot_preview_lease_idx
  on public.multishot_shots(preview_lease_until)
  where preview_status = 'processing';
create index if not exists multishot_temporal_lease_idx
  on public.multishot_shots(temporal_lease_until)
  where temporal_status = 'processing';
create index if not exists multishot_final_lease_idx
  on public.multishot_shots(final_lease_until)
  where final_status = 'processing';