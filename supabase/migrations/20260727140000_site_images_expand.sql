-- Expand site_images with all swappable landing-page slots.
-- Uses ON CONFLICT (key) DO NOTHING so re-running is safe and existing custom
-- overrides are never overwritten.

INSERT INTO public.site_images (key, url, label, section, default_url) VALUES
  -- ── Hero slideshow (9 slides used by index.tsx) ──────────────────────────
  ('hero_slide_1', '/hero/hero-1.png', 'Hero Slide 1', 'hero_slides', '/hero/hero-1.png'),
  ('hero_slide_2', '/hero/hero-2.png', 'Hero Slide 2', 'hero_slides', '/hero/hero-2.png'),
  ('hero_slide_3', '/hero/hero-3.png', 'Hero Slide 3', 'hero_slides', '/hero/hero-3.png'),
  ('hero_slide_4', '/hero/hero-4.png', 'Hero Slide 4', 'hero_slides', '/hero/hero-4.png'),
  ('hero_slide_5', '/hero/hero-5.png', 'Hero Slide 5', 'hero_slides', '/hero/hero-5.png'),
  ('hero_slide_6', '/hero/hero-6.png', 'Hero Slide 6', 'hero_slides', '/hero/hero-6.png'),
  ('hero_slide_7', '/hero/hero-7.png', 'Hero Slide 7', 'hero_slides', '/hero/hero-7.png'),
  ('hero_slide_8', '/hero/hero-8.png', 'Hero Slide 8', 'hero_slides', '/hero/hero-8.png'),
  ('hero_slide_9', '/hero/hero-9.png', 'Hero Slide 9', 'hero_slides', '/hero/hero-9.png'),
  -- ── TikTok section — poster stills (bundled; empty default = use import) ──
  ('tiktok_poster_1', '', 'TikTok Tile 1 — Neon Closeup',   'tiktok', ''),
  ('tiktok_poster_2', '', 'TikTok Tile 2 — Stage Mic',      'tiktok', ''),
  ('tiktok_poster_3', '', 'TikTok Tile 3 — Rooftop Sunset', 'tiktok', ''),
  ('tiktok_poster_4', '', 'TikTok Tile 4 — Court Ball',     'tiktok', ''),
  ('tiktok_poster_5', '', 'TikTok Tile 5 — Studio Gel',     'tiktok', ''),
  ('tiktok_poster_6', '', 'TikTok Tile 6 — Street Golden',  'tiktok', ''),
  -- ── Process steps ─────────────────────────────────────────────────────────
  ('process_step_1', '/landing/step-reference.jpg', 'Process Step 1 — Reference',    'process', '/landing/step-reference.jpg'),
  ('process_step_2', '/landing/step-final.jpg',     'Process Step 2 — Final Output', 'process', '/landing/step-final.jpg'),
  -- ── Gallery row 1 (scrolls left) ─────────────────────────────────────────
  ('gallery_r1_1', '/josh-ref-1.png',       'Gallery Row 1 · Promo',     'gallery', '/josh-ref-1.png'),
  ('gallery_r1_2', '/landing-client-2.png', 'Gallery Row 1 · Editorial', 'gallery', '/landing-client-2.png'),
  ('gallery_r1_3', '/landing-client-4.png', 'Gallery Row 1 · Backstage', 'gallery', '/landing-client-4.png'),
  ('gallery_r1_4', '/landing-photo-3.jpeg', 'Gallery Row 1 · Cover Art', 'gallery', '/landing-photo-3.jpeg'),
  -- ── Gallery row 2 (scrolls right) ────────────────────────────────────────
  ('gallery_r2_1', '/landing-client-5.png',  'Gallery Row 2 · Concert',   'gallery', '/landing-client-5.png'),
  ('gallery_r2_2', '/josh-scene-still.jpeg', 'Gallery Row 2 · Cinema',    'gallery', '/josh-scene-still.jpeg'),
  ('gallery_r2_3', '/landing-client-7.png',  'Gallery Row 2 · Glam',      'gallery', '/landing-client-7.png'),
  ('gallery_r2_4', '/landing-photo-5.jpeg',  'Gallery Row 2 · Cinematic', 'gallery', '/landing-photo-5.jpeg'),
  ('gallery_r2_5', '/landing-photo-6.png',   'Gallery Row 2 · Color',     'gallery', '/landing-photo-6.png')
ON CONFLICT (key) DO NOTHING;
