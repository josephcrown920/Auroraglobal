ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by_code TEXT;

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'CLI',
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON public.api_keys(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys self read" ON public.api_keys FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "api_keys self insert" ON public.api_keys FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "api_keys self update" ON public.api_keys FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "api_keys self delete" ON public.api_keys FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.cli_device_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code TEXT NOT NULL UNIQUE,
  user_code TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_plain TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cli_device_codes_user_code_idx ON public.cli_device_codes(user_code);

GRANT SELECT, UPDATE ON public.cli_device_codes TO authenticated;
GRANT ALL ON public.cli_device_codes TO service_role;
ALTER TABLE public.cli_device_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "device_codes auth read" ON public.cli_device_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "device_codes auth approve" ON public.cli_device_codes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);