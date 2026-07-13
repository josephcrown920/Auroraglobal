CREATE TABLE IF NOT EXISTS public.site_images (
  key         TEXT        PRIMARY KEY,
  url         TEXT        NOT NULL,
  label       TEXT        NOT NULL DEFAULT '',
  section     TEXT        NOT NULL DEFAULT 'general',
  default_url TEXT        NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.site_images (key, url, label, section, default_url) VALUES
  ('hero_1',    '/gallery/josh-pink-mic.png',          'Concert Wash',       'hero',    '/gallery/josh-pink-mic.png'),
  ('hero_2',    '/josh/josh-concert-performance.webp', 'Editorial',          'hero',    '/josh/josh-concert-performance.webp'),
  ('hero_3',    '/josh/josh-orange-performance.jpg',   'Golden Hour',        'hero',    '/josh/josh-orange-performance.jpg'),
  ('hero_4',    '/gallery/josh-neon-tech.png',         'Neon Dreams',        'hero',    '/gallery/josh-neon-tech.png'),
  ('hero_5',    '/gallery/josh-blue-portrait.png',     'Rembrandt',          'hero',    '/gallery/josh-blue-portrait.png'),
  ('hero_6',    '/gallery/violet-haze.webp',           'Violet Haze',        'hero',    '/gallery/violet-haze.webp'),
  ('creator_1', '/gallery/glitter-bath.jpg',           'Boudoir Editorial',  'creator', '/gallery/glitter-bath.jpg'),
  ('creator_2', '/gallery/violet-haze.webp',           'Velvet Fantasy',     'creator', '/gallery/violet-haze.webp'),
  ('creator_3', '/gallery/blonde-selfie.png',          'Golden Seduction',   'creator', '/gallery/blonde-selfie.png'),
  ('creator_4', '/gallery/josh-pink-mic.png',          'Neon Temptation',    'creator', '/gallery/josh-pink-mic.png'),
  ('creator_5', '/gallery/ski-selfie.jpg',             'Luxury Suite',       'creator', '/gallery/ski-selfie.jpg'),
  ('creator_6', '/gallery/ichroma-cover.webp',         'Private Collection', 'creator', '/gallery/ichroma-cover.webp')
ON CONFLICT (key) DO NOTHING;
