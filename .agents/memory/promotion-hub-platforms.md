---
name: Promotion Hub platform quirks
description: Per-platform public-data limits, the tiktok_accounts service-role lockdown, and the leased per-day checkpoint sweep design for /promotion
---

# Promotion Hub platform quirks

## Per-platform public data reality
- **Spotify**: client-credentials Web API → followers/popularity/top tracks/releases. NO monthly listeners or streams (Spotify for Artists has no public stats API) — never promise them.
- **Apple Music**: free iTunes Search/Lookup only — catalog, artwork, release dates. No plays.
- **YouTube**: Data API key → subscribers/total views/video counts + per-video stats.
- **Audiomack**: Data API `https://api.audiomack.com/v1` with OAuth 1.0a consumer-key signing.
- **Boomplay**: NO public stats API — link-only card + best-effort Open Graph scrape of allow-listed public pages.
- **TikTok**: stats need the Display API product (user.info.stats + video.list scopes) enabled in the developer app; posting-only connections get a reconnect state, not an error.

**Why:** adapters were built against what each provider actually exposes publicly; metrics beyond this list require a new provider agreement, not code.
**How to apply:** when touching Promotion cards/metrics, don't add fields these APIs can't return.

## tiktok_accounts is service-role only
Migration 20260905120000 revoked all anon/authenticated access and dropped the own-row policy — tokens were directly SELECT-able by their owner via the Supabase API, materially worse once Display scopes were added.

**Why:** long-lived OAuth tokens must never be client-readable, even by their owner (XSS exfil path).
**How to apply:** never re-grant or re-add a permissive policy on tiktok_accounts; new reads go through `*.functions.ts` server functions.

## Daily sweep = leased per-day checkpoint
`promotion_sweep_state` holds one row per UTC day: keyset cursors (`artist_platform_links.sweep_seq` identity; tiktok `user_id` uuid), phase flags, retry list (cap 50k, overflow counted + retried next day), lease_owner/lease_expires. Runner: 150s budget (daemon curl cap 240s), checkpoint saved after EVERY page via lease-scoped write (throws on zero rows), route answers 503 until done so the daemon retries next tick instead of marking the day complete.

**Why:** offset-from-zero + hard row caps starve everything past the cap, and last-writer-wins upserts let concurrent runners regress cursors — both caught in code review 2026-09-05.
**How to apply:** keep the lease claim a single atomic conditional UPDATE and checkpoint writes fail-closed; never reintroduce offset pagination or in-memory-only dedup for the sweep.
