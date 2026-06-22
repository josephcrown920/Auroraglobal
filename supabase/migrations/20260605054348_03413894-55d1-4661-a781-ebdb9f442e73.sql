
-- 1) Hide gpu_workers.auth_token from client-side reads.
-- Admins can still manage workers via the existing policy, but the auth_token
-- column is no longer selectable through the Data API. Server code (edge
-- functions, server functions) uses the service role which retains access.
REVOKE SELECT (auth_token) ON public.gpu_workers FROM authenticated;
REVOKE SELECT (auth_token) ON public.gpu_workers FROM anon;

-- 2) Realtime channel authorization.
-- Enable RLS on realtime.messages and restrict authenticated subscribers to
-- their own `gens:<uid>` topic (matches client usage in LiveJobsPanel).
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own gens channel" ON realtime.messages;
CREATE POLICY "Users read own gens channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('gens:' || auth.uid()::text)
);

DROP POLICY IF EXISTS "Users write own gens channel" ON realtime.messages;
CREATE POLICY "Users write own gens channel"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() = ('gens:' || auth.uid()::text)
);
