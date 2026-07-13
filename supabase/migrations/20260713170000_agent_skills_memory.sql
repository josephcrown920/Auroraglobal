-- Video Agent Skill System: extend agent tables for skill invocation history
-- and structured brand memory.

-- 1. skill_meta jsonb on agent_chat_messages: stores which skill was invoked
--    in an assistant turn (name, icon, summary, duration_ms). Nullable — only
--    set on assistant messages where a skill was dispatched.
alter table public.agent_chat_messages
  add column if not exists skill_meta jsonb;

-- 2. structured_memory jsonb on agent_user_memory: structured brand profile
--    (brand_voice, tone_keywords, preferred_avatar_id, recurring_characters,
--    past_script_themes). Coexists with the existing free-text `memory` column.
alter table public.agent_user_memory
  add column if not exists structured_memory jsonb;

-- Existing RLS policies already cover these columns (no new policies needed —
-- the table-level policies grant authenticated users access to their own rows).
