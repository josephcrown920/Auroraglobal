
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'landing',
  ref_code TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leads_email_idx ON public.leads (lower(email));
CREATE INDEX leads_created_at_idx ON public.leads (created_at DESC);

GRANT INSERT ON public.leads TO anon, authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
ON public.leads FOR INSERT
TO anon, authenticated
WITH CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

CREATE POLICY "Admins can view leads"
ON public.leads FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
