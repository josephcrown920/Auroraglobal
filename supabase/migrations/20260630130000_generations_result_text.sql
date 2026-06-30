-- Add result_text to generations so text-kind renders can store their output.
-- This column is referenced in types.ts and generate-core.server.ts but was
-- missing from the initial schema.
alter table public.generations add column if not exists result_text text;
