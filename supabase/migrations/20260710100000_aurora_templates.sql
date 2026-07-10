-- Task #275: Aurora Templates — a saved HeyGen template setup (template_id +
-- fixed variables + which variable is the "character" slot) so one scene/story
-- can be re-generated many times with a different character each run.
--
-- Backend-only for now (no picker UI yet). Server functions run with the
-- service role; RLS below is the direct-access safety net for the anon/
-- authenticated Supabase client (owner-only rows).

CREATE TABLE IF NOT EXISTS public.aurora_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  heygen_template_id text NOT NULL CHECK (char_length(heygen_template_id) BETWEEN 1 AND 128),
  -- HeyGen variables map (name → {name,type,properties}) stored verbatim.
  fixed_variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Which key inside fixed_variables is swapped out per generation.
  character_variable_key text NOT NULL CHECK (char_length(character_variable_key) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS aurora_templates_user_idx
  ON public.aurora_templates (user_id, created_at DESC);

ALTER TABLE public.aurora_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aurora_templates_select_own" ON public.aurora_templates;
CREATE POLICY "aurora_templates_select_own" ON public.aurora_templates
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "aurora_templates_insert_own" ON public.aurora_templates;
CREATE POLICY "aurora_templates_insert_own" ON public.aurora_templates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "aurora_templates_update_own" ON public.aurora_templates;
CREATE POLICY "aurora_templates_update_own" ON public.aurora_templates
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "aurora_templates_delete_own" ON public.aurora_templates;
CREATE POLICY "aurora_templates_delete_own" ON public.aurora_templates
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
