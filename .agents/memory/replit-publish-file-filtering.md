---
name: Replit publish file filtering
description: Replit Autoscale publishing file-size limits and the ignore-file behavior verified in this workspace.
---

Replit Autoscale publishing uses `.gitignore` to exclude unnecessary workspace files from the published image; a custom `.replitignore` file is not sufficient on this deployment path. Large development uploads that are already tracked must also be removed from Git tracking, not merely added to `.gitignore`. Keep any runtime-imported assets in `src/assets` or `public` before excluding the upload directory.

**Why:** A publish build can compile and pass its health gate but still fail afterward with `image size is over the limit of 8 GiB` when tracked uploads and dev caches are included.

**How to apply:** Before publishing a large flat-root app, check the tracked byte total and ignore `.cache`, Python/dev environments, staging uploads, scaffold backups, and auxiliary artifact dependencies. Treat the final production build and the image-size publish step as separate checks.