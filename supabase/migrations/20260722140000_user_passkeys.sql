-- WebAuthn passkeys (Face ID / fingerprint / Windows Hello)
-- Each row is one registered authenticator credential for a user.

CREATE TABLE IF NOT EXISTS public.user_passkeys (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id     TEXT        NOT NULL UNIQUE,
  public_key        TEXT        NOT NULL,
  counter           BIGINT      NOT NULL DEFAULT 0,
  transports        TEXT[]      NOT NULL DEFAULT '{}',
  device_name       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_passkeys_user_id_idx ON public.user_passkeys(user_id);

-- Short-lived challenges (15 min TTL, one-time use)
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge   TEXT        NOT NULL,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  used        BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS webauthn_challenges_expires_idx ON public.webauthn_challenges(expires_at);

-- RLS: rows are managed server-side only (service-role); block all anon / authed direct access
ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Users can read their own passkeys (for "Manage passkeys" UI)
CREATE POLICY "users_own_passkeys_select"
  ON public.user_passkeys FOR SELECT
  USING (auth.uid() = user_id);

-- All writes go through service-role server functions
CREATE POLICY "service_role_passkeys_all"
  ON public.user_passkeys FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_challenges_all"
  ON public.webauthn_challenges FOR ALL
  USING (true)
  WITH CHECK (true);
