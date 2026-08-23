---
name: Sibling describe-scoped test constants silently become undefined
description: A test constant (e.g. LOVABLE_URL) declared inside one describe() block is NOT visible in a sibling describe() in the same file; referencing it there resolves to `undefined`, not a ReferenceError-visible bug.
---

In `orchestrator.fallback.test.ts` (and any Bun/Jest-style file with multiple
top-level `describe()` blocks), constants declared with `const` at the top of
one `describe(...)` callback are scoped to that callback's closure only.
Referencing the same-named constant from a *different*, sibling `describe()`
block does not throw — it silently resolves to `undefined` if no other
binding is in scope.

The dangerous failure mode: code like `url.includes(LOVABLE_URL)` with
`LOVABLE_URL === undefined` coerces to `url.includes("undefined")`, which is
simply `false` for every real URL. Every branch in a `if/else if` chain keyed
on such checks quietly falls through to the final `else`/`throw`, and the
resulting error (e.g. "unexpected fetch <url>") looks exactly like a real
mocked-fetch fallthrough bug in the *production* code being tested — not a
scoping bug in the *test*. This can send debugging effort deep into
production fallback-loop logic (extra candidate models being tried, retries
that "shouldn't happen") when the actual defect is a missing local
declaration in the test file.

**Why this matters:** several describe blocks in this file each redeclare
their own local `LOVABLE_URL`/`FAL_URL` (or just inline the literal string)
specifically because these constants are NOT shared across blocks — that's
easy to miss when adding a new describe block modeled after an existing one
several hundred lines away.

**How to apply:** when adding a new `describe()` block to a test file that
uses fetch-URL-matching helpers, either declare all needed URL constants
locally inside the new block (cheapest fix) or inline the literal strings, as
several existing blocks in this file already do. Don't assume a constant
"declared somewhere in this file" is in scope — check whether it's inside the
same `describe()` callback.
