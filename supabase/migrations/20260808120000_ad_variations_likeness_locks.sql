-- Ad Variations + Likeness Locks (ported from the aurora-frontend-template
-- export) plus site_content, which had a local definition inside
-- 20260723112652_user_roles.sql that was never applied to the live DB.
-- All three are user/admin-scoped: RLS on, no anon writes.

-- ── ad_variations ─────────────────────────────────────────────────────────
-- One row per generated ad-variation item in a batch (image / video / text).
CREATE TABLE IF NOT EXISTS public.ad_variations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  batch_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','text')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  aspect TEXT,
  url TEXT,
  text_value TEXT,
  error TEXT,
  likeness_id UUID,
  source_generation_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_variations_user ON public.ad_variations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_variations_batch ON public.ad_variations (batch_id);

ALTER TABLE public.ad_variations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_variations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_variations TO authenticated;
GRANT ALL ON public.ad_variations TO service_role;

DROP POLICY IF EXISTS "Own ad variations select" ON public.ad_variations;
CREATE POLICY "Own ad variations select" ON public.ad_variations
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Own ad variations insert" ON public.ad_variations;
CREATE POLICY "Own ad variations insert" ON public.ad_variations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Own ad variations update" ON public.ad_variations;
CREATE POLICY "Own ad variations update" ON public.ad_variations
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Own ad variations delete" ON public.ad_variations;
CREATE POLICY "Own ad variations delete" ON public.ad_variations
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── likeness_locks ────────────────────────────────────────────────────────
-- A user's locked reference identity: primary photo + optional extra angles.
CREATE TABLE IF NOT EXISTS public.likeness_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  primary_path TEXT NOT NULL,
  extra_paths TEXT[] NOT NULL DEFAULT '{}',
  spec JSONB NOT NULL DEFAULT '{}'::jsonb,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_likeness_locks_user ON public.likeness_locks (user_id, created_at DESC);

ALTER TABLE public.likeness_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.likeness_locks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.likeness_locks TO authenticated;
GRANT ALL ON public.likeness_locks TO service_role;

DROP POLICY IF EXISTS "Own likeness select" ON public.likeness_locks;
CREATE POLICY "Own likeness select" ON public.likeness_locks
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Own likeness insert" ON public.likeness_locks;
CREATE POLICY "Own likeness insert" ON public.likeness_locks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Own likeness update" ON public.likeness_locks;
CREATE POLICY "Own likeness update" ON public.likeness_locks
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Own likeness delete" ON public.likeness_locks;
CREATE POLICY "Own likeness delete" ON public.likeness_locks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── site_content (live DB was missing it) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_content (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','url','json')),
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
-- Design skins (src/lib/design-skins.ts) store JSON blobs in site_content —
-- widen the original text/image/url check for pre-existing tables.
ALTER TABLE public.site_content DROP CONSTRAINT IF EXISTS site_content_kind_check;
ALTER TABLE public.site_content ADD CONSTRAINT site_content_kind_check
  CHECK (kind IN ('text','image','url','json'));
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_content TO authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Site content public read" ON public.site_content;
CREATE POLICY "Site content public read" ON public.site_content
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admins insert content" ON public.site_content;
CREATE POLICY "Admins insert content" ON public.site_content
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update content" ON public.site_content;
CREATE POLICY "Admins update content" ON public.site_content
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins delete content" ON public.site_content;
CREATE POLICY "Admins delete content" ON public.site_content
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
