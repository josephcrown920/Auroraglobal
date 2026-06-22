
-- Generations table
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  prompt text not null,
  mode text not null default 'performance',
  status text not null default 'pending',
  input_images jsonb not null default '[]'::jsonb,
  motion_video_url text,
  result_image_url text,
  error text,
  created_at timestamptz not null default now()
);
alter table public.generations enable row level security;
create policy "own generations select" on public.generations for select using (auth.uid() = user_id);
create policy "own generations insert" on public.generations for insert with check (auth.uid() = user_id);
create policy "own generations update" on public.generations for update using (auth.uid() = user_id);
create policy "own generations delete" on public.generations for delete using (auth.uid() = user_id);

-- Storage bucket
insert into storage.buckets (id, name, public) values ('studio', 'studio', true) on conflict (id) do nothing;
create policy "studio user upload" on storage.objects for insert with check (bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "studio user update" on storage.objects for update using (bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "studio user delete" on storage.objects for delete using (bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "studio own folder select" on storage.objects for select using (bucket_id = 'studio' and auth.uid()::text = (storage.foldername(name))[1]);

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS result_video_url text,
  ADD COLUMN IF NOT EXISTS audio_url text;

-- profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text,
  display_name text,
  plan text not null default 'free',
  credits integer not null default 5,
  lifetime_credits_purchased integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profile self select" on public.profiles for select using (auth.uid() = user_id);
create policy "profile self insert" on public.profiles for insert with check (auth.uid() = user_id);

-- credit ledger
create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  delta integer not null,
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);
alter table public.credit_ledger enable row level security;
create policy "ledger self select" on public.credit_ledger for select using (auth.uid() = user_id);

-- payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null default 'paystack',
  reference text not null unique,
  amount_kobo integer not null,
  currency text not null default 'NGN',
  credits_granted integer not null default 0,
  status text not null default 'pending',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.payments enable row level security;
create policy "payments self select" on public.payments for select using (auth.uid() = user_id);

alter table public.generations add column if not exists credits_cost integer not null default 1;

create or replace function public.touch_updated_at()
returns trigger language plpgsql
security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

create or replace function public.deduct_credits(_user uuid, _amount integer, _reason text, _ref uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare _new int;
begin
  update public.profiles set credits = credits - _amount
    where user_id = _user and credits >= _amount
    returning credits into _new;
  if _new is null then return false; end if;
  insert into public.credit_ledger (user_id, delta, reason, ref_id) values (_user, -_amount, _reason, _ref);
  return true;
end; $$;

create or replace function public.grant_credits(_user uuid, _amount integer, _reason text, _ref uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, credits) values (_user, _amount)
  on conflict (user_id) do update set credits = public.profiles.credits + excluded.credits;
  if _reason = 'purchase' then
    update public.profiles set lifetime_credits_purchased = lifetime_credits_purchased + _amount where user_id = _user;
  end if;
  insert into public.credit_ledger (user_id, delta, reason, ref_id) values (_user, _amount, _reason, _ref);
end; $$;

revoke execute on function public.deduct_credits(uuid, integer, text, uuid) from public, anon, authenticated;
revoke execute on function public.grant_credits(uuid, integer, text, uuid) from public, anon, authenticated;
grant execute on function public.grant_credits(uuid, integer, text, uuid) to service_role;
grant execute on function public.deduct_credits(uuid, integer, text, uuid) to service_role;

-- Roles
do $$ begin create type public.app_role as enum ('admin', 'user'); exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "self read roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user and role = _role);
$$;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, credits) values (new.id, new.email, 5)
    on conflict (user_id) do nothing;
  insert into public.credit_ledger (user_id, delta, reason) values (new.id, 5, 'signup_bonus');
  return new;
end; $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- profile self update with locked credit/plan columns
create policy "profile self update" on public.profiles
  for update to authenticated using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    AND credits IS NOT DISTINCT FROM (SELECT p.credits FROM public.profiles p WHERE p.user_id = auth.uid())
    AND plan IS NOT DISTINCT FROM (SELECT p.plan FROM public.profiles p WHERE p.user_id = auth.uid())
    AND lifetime_credits_purchased IS NOT DISTINCT FROM (SELECT p.lifetime_credits_purchased FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- Admin read-all policies
create policy "admin read all gens" on public.generations for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin read all payments" on public.payments for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin read all profiles" on public.profiles for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text,
  user_id uuid,
  session_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index events_created_at_idx on public.events (created_at desc);
create index events_name_idx on public.events (name);
grant insert on public.events to anon, authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "anyone can insert events" on public.events for insert to anon, authenticated with check (user_id IS NULL OR user_id = auth.uid());
create policy "admin reads events" on public.events for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Generations: favorites + tags
ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS generations_user_fav_idx ON public.generations(user_id, is_favorite) WHERE is_favorite = true;

-- Gift cards
CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  credits integer NOT NULL CHECK (credits > 0),
  amount_usd numeric(10,2) NOT NULL DEFAULT 0,
  design text NOT NULL DEFAULT 'aurora',
  note text,
  created_by uuid NOT NULL,
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
grant select, insert, update, delete on public.gift_cards to authenticated;
grant all on public.gift_cards to service_role;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage gift cards" ON public.gift_cards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Provider logs
CREATE TABLE public.provider_logs (
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
grant select on public.provider_logs to authenticated;
grant all on public.provider_logs to service_role;
ALTER TABLE public.provider_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads provider logs" ON public.provider_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX provider_logs_created_idx ON public.provider_logs(created_at DESC);
CREATE INDEX provider_logs_provider_idx ON public.provider_logs(provider, status);

-- Contact messages
CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT NOT NULL,
  name TEXT,
  topic TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
grant insert on public.contact_messages to anon, authenticated;
grant select, update on public.contact_messages to authenticated;
grant all on public.contact_messages to service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can send contact message" ON public.contact_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "admin reads contact" ON public.contact_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admin updates contact" ON public.contact_messages FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Legal acceptances
CREATE TABLE public.legal_acceptances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document TEXT NOT NULL,
  version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT,
  UNIQUE (user_id, document, version)
);
grant select, insert on public.legal_acceptances to authenticated;
grant all on public.legal_acceptances to service_role;
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self insert acceptance" ON public.legal_acceptances FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "self read acceptance" ON public.legal_acceptances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admin reads acceptance" ON public.legal_acceptances FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- GPU workers
create table public.gpu_workers (
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
grant select, insert, update, delete on public.gpu_workers to authenticated;
grant all on public.gpu_workers to service_role;
alter table public.gpu_workers enable row level security;
create policy "admin manage workers" on public.gpu_workers for all to authenticated
  using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));

create table public.worker_jobs (
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
grant select on public.worker_jobs to authenticated;
grant all on public.worker_jobs to service_role;
alter table public.worker_jobs enable row level security;
create policy "admin reads worker jobs" on public.worker_jobs for select to authenticated using (has_role(auth.uid(),'admin'));

-- Workflows
create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  graph jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.workflows to authenticated;
grant all on public.workflows to service_role;
alter table public.workflows enable row level security;
create policy "wf select own or public" on public.workflows for select to authenticated using (auth.uid() = user_id OR is_public = true);
create policy "wf insert own" on public.workflows for insert to authenticated with check (auth.uid() = user_id);
create policy "wf update own" on public.workflows for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "wf delete own" on public.workflows for delete to authenticated using (auth.uid() = user_id);
create policy "wf admin read" on public.workflows for select to authenticated using (has_role(auth.uid(),'admin'));
create trigger workflows_touch before update on public.workflows for each row execute function public.touch_updated_at();

-- Affiliates
create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  code text not null unique,
  commission_pct int not null default 20,
  total_earned_usd numeric not null default 0,
  payout_email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.affiliates to authenticated;
grant all on public.affiliates to service_role;
alter table public.affiliates enable row level security;
create policy "aff self read" on public.affiliates for select to authenticated using (auth.uid()=user_id);
create policy "aff self upsert" on public.affiliates for insert to authenticated with check (auth.uid()=user_id);
create policy "aff self update" on public.affiliates for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    AND commission_pct IS NOT DISTINCT FROM (SELECT a.commission_pct FROM public.affiliates a WHERE a.user_id = auth.uid())
    AND total_earned_usd IS NOT DISTINCT FROM (SELECT a.total_earned_usd FROM public.affiliates a WHERE a.user_id = auth.uid())
    AND code IS NOT DISTINCT FROM (SELECT a.code FROM public.affiliates a WHERE a.user_id = auth.uid())
  );
create policy "aff admin read" on public.affiliates for select to authenticated using (has_role(auth.uid(),'admin'));

create table public.affiliate_events (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  user_id uuid,
  kind text not null,
  amount_usd numeric default 0,
  ref_id uuid,
  created_at timestamptz not null default now()
);
grant insert, select on public.affiliate_events to anon, authenticated;
grant all on public.affiliate_events to service_role;
alter table public.affiliate_events enable row level security;
CREATE POLICY "aff events insert validated" ON public.affiliate_events FOR INSERT TO anon, authenticated
  WITH CHECK (
    kind = 'click'
    AND (amount_usd IS NULL OR amount_usd = 0)
    AND (user_id IS NULL OR user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.affiliates a WHERE a.code = affiliate_events.code)
  );
create policy "aff events admin read" on public.affiliate_events for select to authenticated using (has_role(auth.uid(),'admin'));
create policy "aff events owner read" on public.affiliate_events for select to authenticated
  using (exists (select 1 from public.affiliates a where a.code = affiliate_events.code and a.user_id = auth.uid()));

-- Realtime generations
ALTER TABLE public.generations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.generations;

-- Leads
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
GRANT SELECT ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit a lead" ON public.leads FOR INSERT TO anon, authenticated
  WITH CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
CREATE POLICY "Admins can view leads" ON public.leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Lipsync jobs
CREATE TABLE public.lipsync_jobs (
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lipsync_jobs TO authenticated;
GRANT ALL ON public.lipsync_jobs TO service_role;
ALTER TABLE public.lipsync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lipsync own select" ON public.lipsync_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lipsync own insert" ON public.lipsync_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lipsync own update" ON public.lipsync_jobs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lipsync own delete" ON public.lipsync_jobs FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lipsync admin read" ON public.lipsync_jobs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER lipsync_jobs_touch BEFORE UPDATE ON public.lipsync_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Grants for public.profiles, generations, payments, credit_ledger
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select, insert, update, delete on public.generations to authenticated;
grant all on public.generations to service_role;
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
grant select on public.credit_ledger to authenticated;
grant all on public.credit_ledger to service_role;
