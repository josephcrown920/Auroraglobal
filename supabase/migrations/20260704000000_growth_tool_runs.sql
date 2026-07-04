-- Task #184: persist Growth Tool runs (daily post calendars, rollout plans,
-- social packs) so artists can revisit past outputs across sessions instead
-- of losing them the moment they navigate away.

CREATE TABLE IF NOT EXISTS public.growth_tool_runs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tool       text        NOT NULL CHECK (tool IN ('daily_posts', 'rollout_plan', 'social_pack')),
  input      jsonb       NOT NULL DEFAULT '{}',
  output     jsonb       NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Supports "recent runs per tool, per user" listing.
CREATE INDEX IF NOT EXISTS growth_tool_runs_user_tool_idx
  ON public.growth_tool_runs (user_id, tool, created_at DESC);

-- Writes happen server-side via service_role only (after a successful,
-- credit-committed generation) — no INSERT policy for `authenticated`.
GRANT SELECT ON public.growth_tool_runs TO authenticated;
GRANT ALL    ON public.growth_tool_runs TO service_role;

ALTER TABLE public.growth_tool_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own growth tool runs select" ON public.growth_tool_runs
  FOR SELECT USING (auth.uid() = user_id);
