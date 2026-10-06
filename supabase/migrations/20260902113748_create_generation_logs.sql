/*
# Create generation review logs

1. New Tables
- `generation_logs` stores each image/video/storyboard generation made by the agent.
- `id` identifies the generation.
- `task_type` records the retrieved task profile.
- `user_request` stores the original creative request.
- `model` and `kind` record the selected provider/model and media type.
- `result_url` stores the generated result when available.
- `review_state` tracks generated, approved, or rejected output.
- `review_notes` and `failed_criteria` store review feedback.
- `memory_summary` records which project memory was applied.
- `created_at` and `updated_at` record lifecycle timestamps.

2. Security
- Row level security is enabled.
- This app has no sign-in flow and uses a shared single-tenant workspace, so anon and authenticated roles receive separate CRUD policies.

3. Important Notes
- The table is created idempotently and existing data is preserved.
- Indexes support review-state filtering.
*/

CREATE TABLE IF NOT EXISTS generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL DEFAULT 'GENERAL',
  user_request text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'image',
  result_url text,
  review_state text NOT NULL DEFAULT 'generated',
  review_notes text,
  memory_summary text,
  failed_criteria text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_generation_logs" ON generation_logs;
CREATE POLICY "anon_select_generation_logs" ON generation_logs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_generation_logs" ON generation_logs;
CREATE POLICY "anon_insert_generation_logs" ON generation_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_generation_logs" ON generation_logs;
CREATE POLICY "anon_update_generation_logs" ON generation_logs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_generation_logs" ON generation_logs;
CREATE POLICY "anon_delete_generation_logs" ON generation_logs FOR DELETE TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_generation_logs_review_state ON generation_logs (review_state);
CREATE INDEX IF NOT EXISTS idx_generation_logs_task_type ON generation_logs (task_type);
