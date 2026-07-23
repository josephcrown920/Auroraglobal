---
name: Tutorial guide PDF is a manual snapshot
description: The downloadable /tutorial-guide.pdf is a static Playwright print of the /tutorial page and must be manually regenerated after content edits.
---

The Aurora tutorial guide PDF served at `/tutorial-guide.pdf` is NOT rendered on the fly — it is a static snapshot produced by printing the live `/tutorial` route with Playwright (chromium lives under `.cache/ms-playwright/`).

**Why:** The page is a React route; the "Download PDF" button links a pre-generated file so users get a real PDF without relying on browser print dialogs.

**How to apply:** After any edit to the tutorial content (`src/components/tutorial/*` or `src/routes/tutorial.lazy.tsx`), regenerate: run the playwright print script (one exists at `.local/gen-tutorial-pdf.cjs`) with the node binary from `available-pid2-node-paths`, executed FROM the workspace root (module resolution fails from /tmp), against `http://localhost:8080/tutorial`. Copy the result to all three locations: `public/tutorial-guide.pdf`, `public/Aurora-Studio-Tutorial-Guide.pdf`, `artifacts/web/public/Aurora-Studio-Tutorial-Guide.pdf` (root `public/` is the actually-served static dir in this flat-root app).
