---
name: runTest / code_execution notebook infra flakiness
description: How to recognize and recover from "Notebook not found" errors surfacing through runTest, vs. genuine test-logic failures.
---

`runTest` (the Playwright-based UI testing subagent) is invoked from inside
the `code_execution` sandbox. Occasionally the sandbox's underlying notebook
process itself dies mid-call, and the failure surfaces as something like
`Error in river service (jsNotebook - evaluate), code: NOT_FOUND, message:
Notebook not found`, or as a `runTest` call that returns with empty/no
output at all followed by a subsequent call reporting the notebook was
auto-restarted. This is an infra fault in the sandbox, not a bug in the test
plan, the app, or the interception/network logic being tested.

**Why:** wasted two retry cycles rewriting the test plan (splitting steps,
simplifying interception logic) before recognizing the error text literally
matches the `code_execution` tool's own documented trigger for using its
`restart` flag.

**How to apply:** if a `runTest` call fails with "Notebook not found" (or
similar river-service NOT_FOUND errors), don't rewrite the test plan —
call `code_execution` with `restart: true` once to get a fresh notebook,
verify with a trivial `console.log` ping, then retry the *same* test plan.
If it fails again for an unrelated reason (e.g. `Failed to fetch` from the
app itself), that's a real signal — investigate the app/dev-server instead
(e.g. cold Vite compile on first route hit; pre-warm routes with `curl`
before running the browser test).
