-- Ensure profiles.user_id is unique so downstream FKs work
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='profiles_user_id_key'
  ) AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id') THEN
    BEGIN
      ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN others THEN NULL;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.agent_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  plan jsonb,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.agent_user_memory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  memory text not null default '',
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aurora_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  cover_url text,
  payload jsonb,
  aura_cost int NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.cm_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.cm_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.cm_templates(id) on delete set null,
  template_name text,
  generation_id uuid references public.generations(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  seq integer not null default 0,
  credits_reserved integer not null default 0,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.comfy_workflows (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  description text,
  kind text not null default 'image' check (kind in ('image', 'video')),
  workflow_json jsonb not null default '{}'::jsonb,
  declared_inputs jsonb not null default '[]'::jsonb,
  default_inputs jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.consent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  policy_version text not null,
  consented_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  to_email text NOT NULL,
  template text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text,
  user_id uuid,
  session_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.gpu_workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  endpoint_url text not null,
  auth_token text,
  region text default 'global',
  capabilities text[] not null default '{image}',
  models text[] not null default '{}',
  priority int not null default 100,
  status text not null default 'active',
  max_concurrency int not null default 4,
  in_flight int not null default 0,
  last_heartbeat timestamptz,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.growth_tool_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool text NOT NULL,
  payload jsonb,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guided_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  steps jsonb NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kids_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  title text,
  brief jsonb not null default '{}'::jsonb,
  scenes jsonb not null default '[]'::jsonb,
  status text not null default 'pending',
  error text,
  poster_url text,
  final_video_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document TEXT NOT NULL,
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT,
  UNIQUE (user_id, document, version)
);

CREATE TABLE IF NOT EXISTS public.lipsync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_url text NOT NULL,
  audio_url text NOT NULL,
  engine text NOT NULL DEFAULT 'sync-v2',
  status text NOT NULL DEFAULT 'queued',
  result_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_url text,
  price_aura integer NOT NULL DEFAULT 0,
  workflow_id uuid,
  payload jsonb,
  status text NOT NULL DEFAULT 'draft',
  runs_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketplace_template_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.marketplace_templates(id) ON DELETE CASCADE,
  runner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_user_id uuid NOT NULL,
  aura_charged integer NOT NULL,
  creator_cut_aura integer NOT NULL,
  platform_cut_aura integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid,
  code_text text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aura_granted int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  provider text NOT NULL,
  endpoint text NOT NULL,
  kind text NOT NULL,
  status text NOT NULL,
  latency_ms integer,
  cost_usd numeric(10,4),
  error text,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  url text NOT NULL,
  alt text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.smoke_runs (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_cost_usd numeric(10,4) default 0,
  summary jsonb
);

CREATE TABLE IF NOT EXISTS public.smoke_checks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.smoke_runs(id) on delete cascade,
  step int not null,
  name text not null,
  status text not null default 'pending',
  latency_ms int,
  cost_usd numeric(10,4),
  output_url text,
  error text,
  raw jsonb,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.spin_variants (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.spin_jobs(id) on delete cascade,
  user_id uuid not null,
  idx int not null,
  label text not null,
  status text not null default 'queued',
  url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.tiktok_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  open_id text not null,
  username text,
  display_name text,
  avatar_url text,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  scope text,
  oauth_state text,
  oauth_state_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.tiktok_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id text,
  video_url text not null,
  title text,
  publish_id text,
  status text not null default 'pending',
  error_msg text,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.tiktok_remixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_video_url text NOT NULL,
  source_generation_id uuid,
  target_count int NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'queued',
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  child_generation_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  child_job_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_photo_avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  photo_url text NOT NULL,
  face_meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.worker_jobs (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references public.gpu_workers(id) on delete set null,
  user_id uuid,
  kind text not null,
  status text not null default 'queued',
  latency_ms int,
  cost_usd numeric,
  error text,
  ref_id uuid,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.worker_register_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text,
  ip text,
  user_agent text,
  ok boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_asset_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'outfit',
  title text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  notes text,
  is_published boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_balance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grants + RLS + self-policy for every new table
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'agent_chat_messages','agent_user_memory','app_settings','aurora_templates','cli_device_codes',
  'cm_batch_items','comfy_workflows','consent_logs','email_log','events','gpu_workers',
  'growth_tool_runs','guided_workflows','kids_stories','legal_acceptances','lipsync_jobs',
  'marketplace_templates','marketplace_template_runs','promo_code_redemptions','provider_logs',
  'site_images','smoke_runs','smoke_checks','spin_variants','tiktok_accounts','tiktok_posts',
  'tiktok_remixes','user_photo_avatars','worker_jobs','worker_register_attempts',
  'admin_asset_packs','api_balance_alerts','user_assets'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=t AND column_name='user_id') THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_self', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t||'_self', t);
    END IF;
  END LOOP;
END $$;
