---
name: Live site-image override table
description: The optional landing image override endpoint depends on a database table that may be missing in the live environment.
---

The landing page has a deliberate bundled-image fallback when the optional site-image override request fails. A missing `public.site_images` table therefore produces a harmless `/api/public/site-images` 500 while the page still renders its built-in imagery.

**Why:** The code and migrations can be present in the workspace while the live database has not received that migration; treating the optional endpoint failure as a visual-site outage would lead to unrelated work during UI changes.

**How to apply:** When preview logs show a lone 500 on the landing page, check `/api/public/site-images` before changing landing components. If it is the missing-table error, handle it as a separate database-migration task unless the user explicitly asks to enable live image overrides.