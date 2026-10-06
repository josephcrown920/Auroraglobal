/*
# Create generations and workflows tables (single-tenant, no auth)

1. New Tables
- `generations` — tracks every image/video generation request made through the agent chat.
  - `id` (uuid, primary key)
  - `kind` (text: 'image' | 'video')
  - `model` (text, e.g. "Seedream 5.0 Pro", "Seedance 2.0")
  - `provider` (text, e.g. "model-ark", "comfyui")
  - `prompt` (text, the user's input prompt)
  - `status` (text: 'pending' | 'running' | 'done' | 'error')
  - `result_url` (text, nullable — the generated image/video URL)
  - `error` (text, nullable — error message if failed)
  - `metadata` (jsonb, nullable — extra data like resolution, duration, etc.)
  - `created_at` (timestamptz, defaults to now)

- `workflows` — stores ComfyUI workflow definitions that can be turned into reusable apps.
  - `id` (uuid, primary key)
  - `name` (text, not null)
  - `description` (text, nullable)
  - `workflow_json` (jsonb, not null — the ComfyUI API-format workflow JSON)
  - `category` (text: 'image' | 'video' | 'audio' | 'tool')
  - `app_enabled` (boolean, default false — whether this workflow is exposed as a one-click app)
  - `icon` (text, nullable — lucide icon name for display)
  - `created_at` (timestamptz, defaults to now)
  - `updated_at` (timestamptz, defaults to now)

2. Security
- Enable RLS on both tables.
- Allow anon + authenticated CRUD because the app is single-tenant with no sign-in.
*/

CREATE TABLE IF NOT EXISTS generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'image',
  model text NOT NULL,
  provider text NOT NULL DEFAULT 'model-ark',
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  result_url text,
  error text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_generations" ON generations;
CREATE POLICY "anon_select_generations" ON generations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_generations" ON generations;
CREATE POLICY "anon_insert_generations" ON generations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_generations" ON generations;
CREATE POLICY "anon_update_generations" ON generations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_generations" ON generations;
CREATE POLICY "anon_delete_generations" ON generations FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  workflow_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  category text NOT NULL DEFAULT 'image',
  app_enabled boolean NOT NULL DEFAULT false,
  icon text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_workflows" ON workflows;
CREATE POLICY "anon_select_workflows" ON workflows FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_workflows" ON workflows;
CREATE POLICY "anon_insert_workflows" ON workflows FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_workflows" ON workflows;
CREATE POLICY "anon_update_workflows" ON workflows FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_workflows" ON workflows;
CREATE POLICY "anon_delete_workflows" ON workflows FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_app_enabled ON workflows (app_enabled) WHERE app_enabled = true;
