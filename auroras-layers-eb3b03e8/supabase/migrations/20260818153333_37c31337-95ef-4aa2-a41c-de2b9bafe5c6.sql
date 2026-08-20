CREATE TABLE public.aurora_characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled artist',
  alias TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  traits JSONB NOT NULL DEFAULT '{}'::jsonb,
  reference_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aurora_characters TO authenticated;
GRANT ALL ON public.aurora_characters TO service_role;
ALTER TABLE public.aurora_characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators manage their own artists" ON public.aurora_characters FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.aurora_character_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.aurora_characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  version INTEGER NOT NULL,
  traits JSONB NOT NULL DEFAULT '{}'::jsonb,
  reference_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (character_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aurora_character_versions TO authenticated;
GRANT ALL ON public.aurora_character_versions TO service_role;
ALTER TABLE public.aurora_character_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creators manage their own artist versions" ON public.aurora_character_versions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.aurora_projects
  ADD COLUMN IF NOT EXISTS character_id UUID REFERENCES public.aurora_characters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS character_version INTEGER,
  ADD COLUMN IF NOT EXISTS storyboard JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_aurora_characters_updated_at BEFORE UPDATE ON public.aurora_characters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();