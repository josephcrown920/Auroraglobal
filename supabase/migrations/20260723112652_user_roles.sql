-- Roles enum + user_roles
DO $tguard$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN CREATE TYPE public.app_role AS ENUM ('admin', 'user'); END IF; END $tguard$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.waitlist TO anon, authenticated;
GRANT SELECT ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join waitlist" ON public.waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND length(email) BETWEEN 3 AND 320);
DROP POLICY IF EXISTS "Admins read waitlist" ON public.waitlist;
CREATE POLICY "Admins read waitlist" ON public.waitlist FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can send message" ON public.contact_messages;
CREATE POLICY "Anyone can send message" ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL AND length(email) BETWEEN 3 AND 320
    AND name IS NOT NULL AND length(name) BETWEEN 1 AND 120
    AND message IS NOT NULL AND length(message) BETWEEN 1 AND 4000
  );
DROP POLICY IF EXISTS "Admins read messages" ON public.contact_messages;
CREATE POLICY "Admins read messages" ON public.contact_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.site_content (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','url')),
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Site content public read" ON public.site_content;
CREATE POLICY "Site content public read" ON public.site_content FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins insert content" ON public.site_content;
CREATE POLICY "Admins insert content" ON public.site_content FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update content" ON public.site_content;
CREATE POLICY "Admins update content" ON public.site_content FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins delete content" ON public.site_content;
CREATE POLICY "Admins delete content" ON public.site_content FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_admin_count INT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT count(*) INTO existing_admin_count FROM public.user_roles WHERE role = 'admin';
  IF existing_admin_count > 0 THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin') ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- Add idempotent columns to generations and profiles
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'image';
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS result_video_url text;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.generations ADD COLUMN IF NOT EXISTS credits_cost integer NOT NULL DEFAULT 1;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lifetime_credits_purchased integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  delta integer not null,
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ledger self select" ON public.credit_ledger;
CREATE POLICY "ledger self select" ON public.credit_ledger FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.deduct_credits(_user uuid, _amount integer, _reason text, _ref uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new int;
BEGIN
  UPDATE public.profiles SET credits = credits - _amount
    WHERE id = _user AND credits >= _amount
    RETURNING credits INTO _new;
  IF _new IS NULL THEN RETURN false; END IF;
  INSERT INTO public.credit_ledger (user_id, delta, reason, ref_id) VALUES (_user, -_amount, _reason, _ref);
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_credits(uuid, integer, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.grant_credits(_user uuid, _amount integer, _reason text, _ref uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET credits = credits + _amount WHERE id = _user;
  IF _reason = 'purchase' THEN
    UPDATE public.profiles SET lifetime_credits_purchased = lifetime_credits_purchased + _amount WHERE id = _user;
  END IF;
  INSERT INTO public.credit_ledger (user_id, delta, reason, ref_id) VALUES (_user, _amount, _reason, _ref);
END; $$;
REVOKE EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text, uuid) TO service_role;

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paystack',
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  external_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub self select" ON public.subscriptions;
CREATE POLICY "sub self select" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS subscriptions_touch ON public.subscriptions;
CREATE TRIGGER subscriptions_touch BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- API keys inbox
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  label text,
  encrypted_key text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api keys self" ON public.api_keys;
CREATE POLICY "api keys self" ON public.api_keys FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS api_keys_touch ON public.api_keys;
CREATE TRIGGER api_keys_touch BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Comfy runs / worker jobs
CREATE TABLE IF NOT EXISTS public.comfy_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workflow text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.comfy_runs TO authenticated;
GRANT ALL ON public.comfy_runs TO service_role;
ALTER TABLE public.comfy_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comfy self" ON public.comfy_runs;
CREATE POLICY "comfy self" ON public.comfy_runs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS comfy_runs_touch ON public.comfy_runs;
CREATE TRIGGER comfy_runs_touch BEFORE UPDATE ON public.comfy_runs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Workflows
CREATE TABLE IF NOT EXISTS public.workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflows TO authenticated;
GRANT ALL ON public.workflows TO service_role;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "workflow self or public" ON public.workflows;
CREATE POLICY "workflow self or public" ON public.workflows FOR SELECT USING (auth.uid() = user_id OR is_public = true);
DROP POLICY IF EXISTS "workflow self write" ON public.workflows;
CREATE POLICY "workflow self write" ON public.workflows FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "workflow self update" ON public.workflows;
CREATE POLICY "workflow self update" ON public.workflows FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "workflow self delete" ON public.workflows;
CREATE POLICY "workflow self delete" ON public.workflows FOR DELETE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS workflows_touch ON public.workflows;
CREATE TRIGGER workflows_touch BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Avatars
CREATE TABLE IF NOT EXISTS public.avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avatars TO authenticated;
GRANT ALL ON public.avatars TO service_role;
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "avatars self" ON public.avatars;
CREATE POLICY "avatars self" ON public.avatars FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS avatars_touch ON public.avatars;
CREATE TRIGGER avatars_touch BEFORE UPDATE ON public.avatars FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Spin jobs (TikTok30)
CREATE TABLE IF NOT EXISTS public.spin_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.spin_jobs TO authenticated;
GRANT ALL ON public.spin_jobs TO service_role;
ALTER TABLE public.spin_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "spin self" ON public.spin_jobs;
CREATE POLICY "spin self" ON public.spin_jobs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS spin_jobs_touch ON public.spin_jobs;
CREATE TRIGGER spin_jobs_touch BEFORE UPDATE ON public.spin_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Content machine (cm_*) tables
CREATE TABLE IF NOT EXISTS public.cm_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  brand_voice text,
  audience text,
  cta text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cm_products TO authenticated;
GRANT ALL ON public.cm_products TO service_role;
ALTER TABLE public.cm_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm products self" ON public.cm_products;
CREATE POLICY "cm products self" ON public.cm_products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS cm_products_touch ON public.cm_products;
CREATE TRIGGER cm_products_touch BEFORE UPDATE ON public.cm_products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.cm_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  scene_hint text,
  motion_hint text,
  script_formula text,
  aspect text DEFAULT '9:16',
  duration integer DEFAULT 8,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cm_templates TO authenticated;
GRANT ALL ON public.cm_templates TO service_role;
ALTER TABLE public.cm_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm tpl select" ON public.cm_templates;
CREATE POLICY "cm tpl select" ON public.cm_templates FOR SELECT USING (auth.uid() = user_id OR is_public = true);
DROP POLICY IF EXISTS "cm tpl write" ON public.cm_templates;
CREATE POLICY "cm tpl write" ON public.cm_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cm tpl update" ON public.cm_templates;
CREATE POLICY "cm tpl update" ON public.cm_templates FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cm tpl delete" ON public.cm_templates;
CREATE POLICY "cm tpl delete" ON public.cm_templates FOR DELETE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS cm_templates_touch ON public.cm_templates;
CREATE TRIGGER cm_templates_touch BEFORE UPDATE ON public.cm_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.cm_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.cm_products(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  total_items integer NOT NULL DEFAULT 0,
  completed_items integer NOT NULL DEFAULT 0,
  credits_reserved integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cm_batches TO authenticated;
GRANT ALL ON public.cm_batches TO service_role;
ALTER TABLE public.cm_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm batches self" ON public.cm_batches;
CREATE POLICY "cm batches self" ON public.cm_batches FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS cm_batches_touch ON public.cm_batches;
CREATE TRIGGER cm_batches_touch BEFORE UPDATE ON public.cm_batches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.cm_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.cm_batches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.cm_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  video_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cm_videos TO authenticated;
GRANT ALL ON public.cm_videos TO service_role;
ALTER TABLE public.cm_videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm videos self" ON public.cm_videos;
CREATE POLICY "cm videos self" ON public.cm_videos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS cm_videos_touch ON public.cm_videos;
CREATE TRIGGER cm_videos_touch BEFORE UPDATE ON public.cm_videos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Leads / promo codes / tiktok jobs
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.leads TO anon, authenticated;
GRANT SELECT ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads insert public" ON public.leads;
CREATE POLICY "leads insert public" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (email IS NOT NULL);
DROP POLICY IF EXISTS "leads read admin" ON public.leads;
CREATE POLICY "leads read admin" ON public.leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.promo_codes (
  code text PRIMARY KEY,
  credits integer NOT NULL DEFAULT 0,
  max_redemptions integer,
  redeemed_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promo read auth" ON public.promo_codes;
CREATE POLICY "promo read auth" ON public.promo_codes FOR SELECT TO authenticated USING (active = true);
DROP TRIGGER IF EXISTS promo_codes_touch ON public.promo_codes;
CREATE TRIGGER promo_codes_touch BEFORE UPDATE ON public.promo_codes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.tiktok_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tiktok_jobs TO authenticated;
GRANT ALL ON public.tiktok_jobs TO service_role;
ALTER TABLE public.tiktok_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tiktok self" ON public.tiktok_jobs;
CREATE POLICY "tiktok self" ON public.tiktok_jobs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS tiktok_jobs_touch ON public.tiktok_jobs;
CREATE TRIGGER tiktok_jobs_touch BEFORE UPDATE ON public.tiktok_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
