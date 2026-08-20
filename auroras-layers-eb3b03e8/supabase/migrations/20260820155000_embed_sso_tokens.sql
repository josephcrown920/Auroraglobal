CREATE TABLE public.aurora_embed_sso_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  host_origin text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX aurora_embed_sso_tokens_expires_at_idx
  ON public.aurora_embed_sso_tokens (expires_at);

REVOKE ALL ON public.aurora_embed_sso_tokens FROM anon, authenticated;
GRANT ALL ON public.aurora_embed_sso_tokens TO service_role;

ALTER TABLE public.aurora_embed_sso_tokens ENABLE ROW LEVEL SECURITY;