---
name: runTest subagent can hard-stall on trivial flows
description: When runTest repeatedly hits "Maximum testing iterations (10) reached" even on a minimal plan, treat it as the browser subagent being stuck this session, not a plan-authoring problem.
---

Distinct from the "notebook not found" river-service infra fault (see
[runTest/code_execution notebook infra flakiness](runtest-notebook-infra.md)),
`runTest` can also fail by hitting its internal step budget —
"Maximum testing iterations (10) reached" — without ever returning a
`testOutput` describing what it was doing. Simplifying the test plan
(dropping steps, removing unicode like "·", isolating to a single
login-only flow) did not change the outcome, and neither did explicitly
restarting the `code_execution` notebook (`restart: true`) before retrying —
the failure reproduced identically across 4 consecutive attempts with
different plans in the same session, while the credentials/flow being
tested were independently confirmed to work via a direct Supabase Auth API
call.

**Why:** this points to the Playwright-driving subagent itself being wedged
for the session (e.g. stuck retrying some browser interaction internally),
not a defect in the test plan or the app under test — a real app bug would
normally surface as `status: "failure"` with a descriptive `testOutput`,
not a silent iteration-budget exhaustion on a 4-step plan.

**How to apply:** if 2-3 consecutive `runTest` calls (including one after a
notebook restart) all hit "Maximum testing iterations" with no useful
`testOutput`, stop iterating on the test plan. Fall back to
[Direct-invocation testing](direct-invocation-testing.md) to verify the
real server-side logic, lean on existing unit/integration coverage, and
report the runTest infra issue transparently rather than claiming full e2e
verification.
