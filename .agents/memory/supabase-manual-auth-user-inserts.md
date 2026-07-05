---
name: Manually inserting Supabase auth.users rows for test accounts
description: Direct SQL insert into auth.users causes GoTrue login 500 unless nullable string token columns are set to '' not NULL
---

When creating a test user directly via SQL (bypassing signup, e.g. to dodge email rate limits or avoid live email delivery), a plain `INSERT INTO auth.users (...)` that leaves `confirmation_token`, `recovery_token`, `email_change`, `email_change_token_new`, `email_change_token_current`, `phone_change`, `phone_change_token`, `reauthentication_token` as `NULL` causes GoTrue's `/token` (password login) to fail with a 500 "Database error querying schema" — GoTrue's Go struct scan expects empty string, not NULL, for these columns.

**Why:** GoTrue queries `auth.users` with a fixed column set and fails the scan on NULL where it expects `varchar` defaulting to `''`; this only surfaces at login time, not at insert time, so the bad row looks fine until someone tries to sign in.

**How to apply:** After any direct SQL insert into `auth.users` (plus a matching `auth.identities` row for email/password), immediately `UPDATE auth.users SET confirmation_token = coalesce(confirmation_token,''), recovery_token = coalesce(recovery_token,''), email_change = coalesce(email_change,''), email_change_token_new = coalesce(email_change_token_new,''), email_change_token_current = coalesce(email_change_token_current,''), phone_change = coalesce(phone_change,''), phone_change_token = coalesce(phone_change_token,''), reauthentication_token = coalesce(reauthentication_token,'') WHERE id = ...` before attempting a UI login test.
