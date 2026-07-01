-- Spin viral-engine upgrade: identity linkage + per-variant variation specs.
-- Each spin variant now carries a rich, LLM-generated (or deterministic-fallback)
-- scene spec plus the fully-composed image prompt used to render it, so the grid
-- produces genuinely UNIQUE looks (location/outfit/camera/lighting/mood/framing)
-- while staying locked to one avatar's face reference.

-- Identity the whole batch is locked to (nullable: batches can run without a face).
ALTER TABLE public.spin_jobs ADD COLUMN IF NOT EXISTS avatar_id uuid;
ALTER TABLE public.spin_jobs ADD COLUMN IF NOT EXISTS face_url text;

-- Per-variant generation inputs + failure surface.
ALTER TABLE public.spin_variants ADD COLUMN IF NOT EXISTS prompt text;
ALTER TABLE public.spin_variants ADD COLUMN IF NOT EXISTS spec jsonb;
ALTER TABLE public.spin_variants ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'image';
ALTER TABLE public.spin_variants ADD COLUMN IF NOT EXISTS error text;
