-- Production intelligence foundation: customer CRM + unified activity + GPU pool health.

CREATE TABLE IF NOT EXISTS public.crm_customers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lifecycle_stage text NOT NULL DEFAULT 'lead' CHECK (lifecycle_stage IN ('lead','trial','active','at_risk','churned','vip')),
  source text,
  company_name text,
  notes text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  last_contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  title text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  due_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS entity_id text;
CREATE INDEX IF NOT EXISTS events_user_created_idx ON public.events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_name_created_idx ON public.events(name, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_activities_user_created_idx ON public.crm_activities(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crm_tasks_assignee_status_idx ON public.crm_tasks(assigned_to, status, due_at);

ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.crm_customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tasks TO authenticated;
GRANT ALL ON public.crm_customers, public.crm_activities, public.crm_tasks TO service_role;

DROP POLICY IF EXISTS "crm customer self" ON public.crm_customers;
CREATE POLICY "crm customer self" ON public.crm_customers FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "crm customer admin" ON public.crm_customers;
CREATE POLICY "crm customer admin" ON public.crm_customers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "crm activity self" ON public.crm_activities;
CREATE POLICY "crm activity self" ON public.crm_activities FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "crm activity admin" ON public.crm_activities;
CREATE POLICY "crm activity admin" ON public.crm_activities FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "crm task self" ON public.crm_tasks;
CREATE POLICY "crm task self" ON public.crm_tasks FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "crm task admin" ON public.crm_tasks;
CREATE POLICY "crm task admin" ON public.crm_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Pool-level health is deliberately derived from live worker rows, not a manually maintained flag.
CREATE OR REPLACE VIEW public.gpu_pool_health AS
SELECT
  count(*) FILTER (WHERE status IN ('active','online','degraded'))::int AS configured_workers,
  count(*) FILTER (WHERE status IN ('active','online'))::int AS healthy_workers,
  count(*) FILTER (WHERE status = 'degraded')::int AS degraded_workers,
  count(*) FILTER (WHERE status IN ('paused','offline'))::int AS unavailable_workers,
  coalesce(sum(in_flight), 0)::int AS in_flight,
  coalesce(sum(max_concurrency), 0)::int AS max_concurrency,
  CASE WHEN coalesce(sum(max_concurrency),0) > 0
    THEN round((coalesce(sum(in_flight),0)::numeric / sum(max_concurrency)::numeric) * 100, 2)
    ELSE 0 END AS utilization_pct,
  CASE WHEN count(*) FILTER (WHERE status IN ('active','online','degraded')) > 0
    THEN round((count(*) FILTER (WHERE status IN ('active','online'))::numeric / count(*) FILTER (WHERE status IN ('active','online','degraded'))::numeric) * 100, 2)
    ELSE 0 END AS healthy_pct,
  min(last_heartbeat) FILTER (WHERE status IN ('active','online')) AS oldest_healthy_heartbeat,
  max(last_probe_at) AS last_probe_at
FROM public.gpu_workers;

GRANT SELECT ON public.gpu_pool_health TO authenticated, service_role;

COMMENT ON VIEW public.gpu_pool_health IS
  'Derived GPU pool health: healthy/degraded/unavailable worker counts, aggregate capacity, utilization, healthy percentage, and probe freshness.';
