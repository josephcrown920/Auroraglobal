---
name: Admin reservation reconciliation
description: Safety rules for manually reconciling credits_reserved from admin tooling.
---

Never release a profile's aggregate `credits_reserved` balance wholesale. Reconcile one
terminal job at a time, fence on its unsettled marker and exact reserved amount, commit
succeeded jobs, and release failed jobs. Preserve the acting admin on the settlement
ledger row and retain the established `commit:` / `release:` reason prefixes.

**Why:** A profile's reserved balance can combine several jobs. A profile-level refund
can clear active work or refund a successful render, and a custom ledger reason can stop
the refund from offsetting daily-spend accounting.

**How to apply:** Any admin repair UI or automated reconciler must select terminal,
overdue, unsettled jobs and use a database-side compare-and-swap settlement. Never infer
that an old profile timestamp means every reservation in that aggregate is abandoned.