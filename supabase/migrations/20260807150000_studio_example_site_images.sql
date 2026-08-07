-- Studio's empty-canvas example strip is operator-managed through the existing
-- site_images controls. Keep the static URLs in the app as a fallback for
-- environments that have not received this migration yet.
INSERT INTO public.site_images (key, url, label, section, default_url) VALUES
  ('studio-example-golden-hour-perf', '/sample-photos/fire-street.png', 'Golden Hour', 'studio_examples', '/sample-photos/fire-street.png'),
  ('studio-example-tokyo-rain', '/demo-tokyo-rain-1.png', 'Tokyo Rain', 'studio_examples', '/demo-tokyo-rain-1.png'),
  ('studio-example-editorial-split', '/sample-photos/red-dreads-chain.png', 'Editorial', 'studio_examples', '/sample-photos/red-dreads-chain.png'),
  ('studio-example-concert-stage', '/__l5e/assets-v1/b7648a1b-297a-48cd-be0f-2effe57dc46f/josh-stage-shades.jpg', 'Stage', 'studio_examples', '/__l5e/assets-v1/b7648a1b-297a-48cd-be0f-2effe57dc46f/josh-stage-shades.jpg'),
  ('studio-example-gold-luxury', '/sample-photos/balloon-josh.png', 'Gold Luxury', 'studio_examples', '/sample-photos/balloon-josh.png')
ON CONFLICT (key) DO NOTHING;