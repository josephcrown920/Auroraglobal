---
name: Static public/ file shadows a dynamic route
description: A file in public/ (e.g. sitemap.xml) is served before any TanStack server route with the same path — dynamic logic silently never runs.
---

The rule: if a path exists as a static file under `public/` (and its stale copy in `.output/public/`), vite/nitro serve that file directly and a TanStack server route registered for the same path never executes.

**Why:** static assets are matched before router routes, and there is no error or log when a route is shadowed — the dynamic handler simply never fires, so its output silently never changes.

**How to apply:** when adding or debugging any dynamic route for a "file-looking" path (`sitemap.xml`, `robots.txt`, `manifest.json`, `.well-known/*`), first check `public/` and `.output/public/` for a same-named static file and delete it. If a dynamic route's changes don't show up in curl, suspect static shadowing before debugging the handler.
