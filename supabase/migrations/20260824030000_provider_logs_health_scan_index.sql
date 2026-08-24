-- provider-health-check cron scans provider_logs with
--   WHERE kind IN (...) AND created_at >= <2h cutoff> ORDER BY created_at DESC
-- every 15 minutes. Without an index this is a sequential scan over the whole
-- table on every run. Composite (kind, created_at) matches the filter +
-- ordering exactly.
--
-- Read-only performance change: no data, RLS, or grant changes.
create index if not exists idx_provider_logs_kind_created_at
  on public.provider_logs (kind, created_at desc);
