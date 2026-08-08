-- Follow-up hardening for the Lovable-export port (2026-08-08).
--
-- 1) ad_variations CHECK constraints were too narrow: the application inserts
--    kinds 'hook' / 'caption' / 'thumbnail' / 'aspect_render' and status
--    'succeeded', which the original constraints rejected — every text or
--    aspect-render insert would fail. Widen both (keeping the original values
--    so nothing already inserted breaks).
--
-- 2) video_agent_submissions: server-side provenance for the async HeyGen
--    Video Agent API. Binds each provider video_id to the submitting user,
--    their credit reservation, and the server-computed cost, so /status and
--    /finalize can authorize by ownership and never trust client-supplied
--    url/prompt/cost/reservationRef. Service-role only — accessed exclusively
--    from server routes.

ALTER TABLE public.ad_variations
  DROP CONSTRAINT IF EXISTS ad_variations_kind_check;
ALTER TABLE public.ad_variations
  ADD CONSTRAINT ad_variations_kind_check
  CHECK (kind IN ('image','video','text','hook','caption','thumbnail','aspect_render'));

ALTER TABLE public.ad_variations
  DROP CONSTRAINT IF EXISTS ad_variations_status_check;
ALTER TABLE public.ad_variations
  ADD CONSTRAINT ad_variations_status_check
  CHECK (status IN ('pending','processing','done','failed','succeeded'));

CREATE TABLE IF NOT EXISTS public.video_agent_submissions (
  video_id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  reservation_ref UUID NOT NULL,
  prompt TEXT NOT NULL,
  orientation TEXT NOT NULL DEFAULT 'landscape',
  cost BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ,
  generation_id UUID
);
CREATE INDEX IF NOT EXISTS idx_video_agent_submissions_user
  ON public.video_agent_submissions (user_id, created_at DESC);

ALTER TABLE public.video_agent_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_agent_submissions FROM anon, authenticated;
GRANT ALL ON public.video_agent_submissions TO service_role;
