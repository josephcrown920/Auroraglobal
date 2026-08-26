---
name: Expo/Metro inotify watcher budget
description: The container's inotify watch limit is fixed and shared; the Expo workflow can die with ENOSPC when other watchers hold the budget.
---

# Expo/Metro inotify watcher budget

The container's `fs.inotify.max_user_watches` (65536) cannot be raised — sysctl and /proc writes are both permission-denied. The main flat-root vite dev server, tsserver, and Metro (which walks node_modules with no watchman) together exceed it, so whichever starts last fails with `ENOSPC: System limit for number of file watchers reached`.

**Why:** fixed kernel budget shared by all watcher-hungry processes; retrying the failed workflow without freeing watchers always fails again.

**How to apply:** on an expo-workflow ENOSPC, free watchers first (kill tsserver — it respawns on demand — and any stale metro/expo processes), then restart the workflow. Durable fix directions: shrink the main vite watcher's ignore scope or give Metro watchman.

Artifact vite dev servers (e.g. aurora-ds) die the same way — at boot or mid-run the moment a NEW file appears in their tree while the budget is exhausted. Running `tsc -p` inside an artifact writes `.tsbuildinfo`, which vite immediately tries to watch → instant ENOSPC crash. Artifact vite configs should carry `server.watch.ignored: ["**/*.tsbuildinfo"]` (aurora-ds has it since 2026-08-26), and prefer running tsc checks when you can tolerate a dev-server restart anyway.

Gotcha when freeing watchers: `pkill -f tsserver` matches the shell command's own cmdline and kills it (exit -1); bracket-escape the pattern, e.g. `pkill -f 'tsserve[r]'`.
