/*
# Add missing notebook seed entries

1. Adds notebook entries for categories not yet seeded:
   - body_ref, tattoo_map, world_building, brand_rules, approved_shot, playbook

2. No schema changes — uses existing notebook_entries table.
*/

INSERT INTO notebook_entries (title, category, body, image_url, tags, status, sort_order) VALUES
  ('Josh — Body Reference', 'body_reference', 'Athletic build, approximately 5''10". Broad shoulders, lean torso. Arm tattoos on both forearms (tribal patterns). Skin tone: deep brown, even. Visible musculature in arms when jersey sleeves are pushed up.', NULL, ARRAY['body', 'identity', 'reference'], 'approved', 9),
  ('Josh — Tattoo Map', 'tattoo_map', 'Left forearm: tribal band 2" above wrist. Right forearm: small cross on inner wrist, tribal pattern running up to elbow. Neck: small "J" behind left ear. All tattoos must be in the same position on every shot.', NULL, ARRAY['tattoo', 'identity', 'continuity'], 'approved', 10),
  ('World Building — Josh Universe', 'world_building', 'Set in a nameless urban core. The streets are always wet, always neon-lit. Police presence is constant but futile — they run but never catch anyone. The world feels like a music video, not a documentary. Time is ambiguous — could be 2am any night.', NULL, ARRAY['world', 'setting', 'lore'], 'approved', 11),
  ('Brand Rules — Visual Identity', 'brand_rules', 'Josh brand colors: red (#E63946), black (#1D1D1D), white. Never use purple or green as primary palette. Logo: the "J" pendant must be visible in at least one hero shot per section. Social media crops must keep Josh center-frame.', NULL, ARRAY['brand', 'rules', 'visual'], 'approved', 12),
  ('Approved Shot — Hook Frame 05', 'approved_shot', 'The over-the-shoulder glance in frame 05 is the approved hero shot for the hook section. Use this as image-to-image reference for all other hook frames to maintain identity and lighting consistency.', 'https://images.pexels.com/photos/18570541/pexels-photo-18570541.jpeg?auto=compress&cs=tinysrgb&w=600', ARRAY['approved', 'reference', 'hook', 'hero-shot'], 'approved', 13),
  ('Production Playbook — Full Pipeline', 'playbook', '1. Read Context for scene brief, camera, and constraints. 2. Pull character identity from Notebook (face, body, tattoos, jewelry). 3. Apply wardrobe lock. 4. Apply continuity rules (rain, officers, identity). 5. Use prompt recipe as base. 6. Set camera per section rules. 7. Generate at 1080p 24fps. 8. Check acceptance criteria. 9. If identity drifts, re-generate with approved shot as reference. 10. Log any failures as lessons for future generations.', NULL, ARRAY['playbook', 'process', 'pipeline'], 'approved', 14)
ON CONFLICT DO NOTHING;
