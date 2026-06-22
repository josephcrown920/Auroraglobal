
-- Add input_videos column to generations (for lipsync inputs)
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS input_videos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- User webhooks table
CREATE TABLE IF NOT EXISTS public.user_webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}'::text[],
  secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_webhooks TO authenticated;
GRANT ALL ON public.user_webhooks TO service_role;

ALTER TABLE public.user_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own webhooks select" ON public.user_webhooks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own webhooks insert" ON public.user_webhooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own webhooks update" ON public.user_webhooks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own webhooks delete" ON public.user_webhooks
  FOR DELETE USING (auth.uid() = user_id);
