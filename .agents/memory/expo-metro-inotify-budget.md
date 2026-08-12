---
name: Expo/Metro inotify watcher budget
description: The container's inotify watch limit is fixed and shared; the Expo workflow can die with ENOSPC when other watchers hold the budget.
---

# Expo/Metro inotify watcher budget

The container's `fs.inotify.max_user_watches` (65536) cannot be raised — sysctl and /proc writes are both permission-denied. The main flat-root vite dev server, tsserver, and Metro (which walks node_modules with no watchman) together exceed it, so whichever starts last fails with `ENOSPC: System limit for number of file watchers reached`.

**Why:** fixed kernel budget shared by all watcher-hungry processes; retrying the failed workflow without freeing watchers always fails again.

**How to apply:** on an expo-workflow ENOSPC, free watchers first (kill tsserver — it respawns on demand — and any stale metro/expo processes), then restart the workflow. Durable fix directions: shrink the main vite watcher's ignore scope or give Metro watchman.
