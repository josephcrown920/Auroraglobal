-- Task — "Free GPU only" mode.
-- A tiny, generic key/value store for global app settings the owner controls at
-- runtime (survives restarts). The first setting is `free_gpu_only`: when ON the
-- orchestrator refuses every paid external provider and serves only the
-- self-hosted GPU pool plus genuinely free ($0) providers.
-- No public access: service-role writes (bypasses RLS); admin reads/writes go
-- through SECURITY-checked server fns using the service-role key, mirroring the
-- scheduler_heartbeats pattern.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
-- No authenticated-client write policy is exposed: changing a global safety flag
-- must go through the admin-gated server fn, never directly from the browser.
