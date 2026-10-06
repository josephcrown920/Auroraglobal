---
name: TikTok post status taxonomy
description: The shared status-classification rule for TikTok publishing, background recovery, and UI behavior.
---

Treat `PROCESSING_TRANSCODE` as a normal non-terminal TikTok publishing state. Keep the server parser, stale-post sweeper, and post-button UI on one shared exhaustive status taxonomy.

**Why:** TikTok can return this documented intermediate state even though older local unions omitted it. If the server persists it but the UI does not classify it as processing, the post button becomes enabled and users can submit a duplicate while the first post is still transcoding.

**How to apply:** Any TikTok status addition or change must update the shared taxonomy and its exhaustive tests. Unknown provider statuses should fail explicitly and be retried rather than persisted through an unchecked cast.

A stale non-terminal row with no `publish_id` cannot be polled and must transition to a retryable failure after the initiation window.

**Why:** Process interruption can occur after the local row insert but before TikTok's publish ID is persisted. Leaving that row pending produces an indefinite spinner, while filtering it out of the sweeper makes it permanent.

**How to apply:** Bound the initial TikTok request with a timeout, and have the cron sweep atomically fail stale no-ID rows so the controlled retry flow becomes available.