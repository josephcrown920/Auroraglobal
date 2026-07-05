-- Spin premium "video mode": Product Showcase template can now render 30
-- talking-portrait videos (avatar holding the uploaded product, speaking the
-- uploaded script) instead of 30 stills. Photo mode is unchanged/default.

ALTER TABLE public.spin_jobs ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'photo';
ALTER TABLE public.spin_jobs ADD COLUMN IF NOT EXISTS script text;
ALTER TABLE public.spin_jobs ADD COLUMN IF NOT EXISTS product_url text;
-- Shared TTS narration for the whole batch (script is spoken identically across
-- all 30 clips — one voice render, muxed into every variant's lip-sync stage).
ALTER TABLE public.spin_jobs ADD COLUMN IF NOT EXISTS audio_url text;
