-- NBA Josh's Looping Officers workflow is durable server state. The JSON
-- payload is intentionally constrained by the application Zod contract rather
-- than a brittle database JSON schema, but it stays on the owner-scoped project
-- envelope so existing RLS is inherited.

alter table public.video_agent_projects
  add column if not exists production jsonb;

comment on column public.video_agent_projects.production is
  'Typed production-plan payload for media-first named Video Agent workflows.';