-- Template Marketplace
-- Creators submit canvas templates; admin approves them; users run them and pay
-- a per-run Aura fee split between creator and platform.

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketplace_templates (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name               text        NOT NULL,
  description        text        NOT NULL DEFAULT '',
  thumbnail_url      text,
  graph_json         jsonb       NOT NULL DEFAULT '{}',
  category           text        NOT NULL DEFAULT 'Other',
  tags               text[]      NOT NULL DEFAULT '{}',
  status             text        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft','pending','approved','rejected')),
  rejection_reason   text,
  -- creator gets cut_pct % of run_cost_aura on every run
  cut_pct            numeric(5,2) NOT NULL DEFAULT 30,
  run_cost_aura      integer      NOT NULL DEFAULT 5 CHECK (run_cost_aura >= 1),
  run_count          integer      NOT NULL DEFAULT 0,
  created_at         timestamptz  NOT NULL DEFAULT now(),
  updated_at         timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_template_runs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id       uuid        NOT NULL REFERENCES public.marketplace_templates(id) ON DELETE CASCADE,
  runner_user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_user_id   uuid        NOT NULL,
  aura_charged      integer     NOT NULL,
  creator_cut_aura  numeric(10,4) NOT NULL,
  platform_cut_aura numeric(10,4) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_marketplace_templates_creator
  ON public.marketplace_templates(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_templates_status
  ON public.marketplace_templates(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_template_runs_template
  ON public.marketplace_template_runs(template_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_template_runs_creator
  ON public.marketplace_template_runs(creator_user_id);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.marketplace_templates_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_templates_updated_at ON public.marketplace_templates;
CREATE TRIGGER trg_marketplace_templates_updated_at
  BEFORE UPDATE ON public.marketplace_templates
  FOR EACH ROW EXECUTE FUNCTION public.marketplace_templates_set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.marketplace_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_template_runs ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can browse approved templates
CREATE POLICY "marketplace_templates_read_approved"
  ON public.marketplace_templates FOR SELECT
  USING (status = 'approved');

-- Creator can see and manage their own templates
CREATE POLICY "marketplace_templates_creator_select"
  ON public.marketplace_templates FOR SELECT
  TO authenticated
  USING (creator_user_id = auth.uid());

CREATE POLICY "marketplace_templates_creator_insert"
  ON public.marketplace_templates FOR INSERT
  TO authenticated
  WITH CHECK (creator_user_id = auth.uid());

-- USING sees OLD row: only rows that are currently draft/pending/rejected can be updated.
-- WITH CHECK sees NEW row: after update, owner must still match.
-- (Approved rows are intentionally read-only for creators; admin uses service_role.)
CREATE POLICY "marketplace_templates_creator_update"
  ON public.marketplace_templates FOR UPDATE
  TO authenticated
  USING (creator_user_id = auth.uid() AND status IN ('draft','pending','rejected'))
  WITH CHECK (creator_user_id = auth.uid());

-- Creators see their own run history
CREATE POLICY "marketplace_template_runs_creator_select"
  ON public.marketplace_template_runs FOR SELECT
  TO authenticated
  USING (creator_user_id = auth.uid());

-- Runners can see their own runs
CREATE POLICY "marketplace_template_runs_runner_select"
  ON public.marketplace_template_runs FOR SELECT
  TO authenticated
  USING (runner_user_id = auth.uid());

-- All writes (inserts, admin updates) go through service_role (server fns)
GRANT SELECT ON public.marketplace_templates TO authenticated;
GRANT INSERT, UPDATE ON public.marketplace_templates TO authenticated;
GRANT SELECT ON public.marketplace_template_runs TO authenticated;
GRANT ALL ON public.marketplace_templates TO service_role;
GRANT ALL ON public.marketplace_template_runs TO service_role;
