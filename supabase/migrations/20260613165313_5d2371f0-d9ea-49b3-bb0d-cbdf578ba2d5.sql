
CREATE TABLE public.spin_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  prompt text not null,
  total int not null default 30,
  status text not null default 'running',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spin_jobs TO authenticated;
GRANT ALL ON public.spin_jobs TO service_role;
ALTER TABLE public.spin_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spin_jobs" ON public.spin_jobs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.spin_variants (
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
CREATE INDEX spin_variants_job_idx ON public.spin_variants(job_id, idx);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spin_variants TO authenticated;
GRANT ALL ON public.spin_variants TO service_role;
ALTER TABLE public.spin_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spin_variants" ON public.spin_variants FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER spin_jobs_touch BEFORE UPDATE ON public.spin_jobs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER spin_variants_touch BEFORE UPDATE ON public.spin_variants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
