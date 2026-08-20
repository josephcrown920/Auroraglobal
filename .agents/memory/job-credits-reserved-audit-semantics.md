---
name: Job credits_reserved audit semantics
description: How to distinguish outstanding job reservations from historical settlement amounts.
---

`jobs.credits_reserved` is retained as the historical amount used by `finalize_job`; it is not cleared after a successful commit. The live outstanding reservation is `profiles.credits_reserved`, and a successful settlement is proven by the matching zero-delta `commit:job_*` ledger entry plus a succeeded generation.

**Why:** An end-to-end smoke initially treated a succeeded job's nonzero `jobs.credits_reserved` as a leaked reservation even though `finalize_job` had atomically committed the credits and cleared the profile reservation.

**How to apply:** For job-generation smokes, assert job status, generation result URL, `profiles.credits_reserved = 0`, the expected commit ledger entry, and no release entry; do not require `jobs.credits_reserved = 0`.