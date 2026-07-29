---
name: Live site-image override table
description: The optional landing image override endpoint depends on a database table that may be missing in the live environment.
---

The landing page has a deliberate bundled-image fallback when the optional site-image override request fails. The public endpoint now converts the known missing-table response into `200 []`, allowing the page to keep rendering its built-in imagery without a runtime error.

**Why:** The code and migrations can be present in the workspace while the live database has not received that migration; an optional override request must not crash an otherwise functional landing page.

**How to apply:** When preview logs show a site-image issue, check `/api/public/site-images` before changing landing components. Missing-table responses should remain a successful empty list; other database errors should still return 500 and remain observable. The migration is still a separate follow-up if live image overrides are needed.