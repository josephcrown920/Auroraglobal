CREATE TABLE public.aurora_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled shoot',
  prompt text NOT NULL DEFAULT '',
  image_model text NOT NULL DEFAULT 'google/gemini-3-pro-image',
  video_model text NOT NULL DEFAULT 'google/veo-3.1-lite',
  brain_model text NOT NULL DEFAULT 'google/gemini-3.7-flash',
  identity_lock boolean NOT NULL DEFAULT true,
  character_reference_path text,
  source_path text,
  preview_path text,
  layers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aurora_projects TO authenticated;
GRANT ALL ON public.aurora_projects TO service_role;
ALTER TABLE public.aurora_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators can view their own Aurora projects" ON public.aurora_projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Creators can create their own Aurora projects" ON public.aurora_projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Creators can update their own Aurora projects" ON public.aurora_projects FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Creators can delete their own Aurora projects" ON public.aurora_projects FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.set_aurora_project_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_aurora_projects_updated_at
BEFORE UPDATE ON public.aurora_projects
FOR EACH ROW EXECUTE FUNCTION public.set_aurora_project_updated_at();
CREATE INDEX aurora_projects_user_updated_idx ON public.aurora_projects (user_id, updated_at DESC);