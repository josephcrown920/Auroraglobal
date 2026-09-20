# Codex Aurora — Aurora Global Integration Boundary

## Goal
Provide Dola Seed Studio with a safe Aurora coding-agent backend while keeping browser clients away from unrestricted repository, shell, deployment, and credential access.

## Flow
Dola Seed Studio GUI
-> authenticated Aurora coding endpoint
-> Aurora MCP/director
-> managed coding/reasoning agent
-> reviewable plan/patch
-> human approval
-> controlled workspace executor

## Required server-side capabilities
- repository/workspace context
- file read/write through allowlisted workspace APIs
- diff generation
- patch apply/reject
- test/lint/build execution in a sandbox
- job status
- audit log
- cancellation/timeouts

## Security requirements
- no secrets in model context unless explicitly required and policy-approved
- no arbitrary browser-side shell
- no unrestricted outbound network
- path traversal protection
- command allowlist
- resource/time limits
- approval gate for destructive operations
- audit all writes and executions
- reject or isolate prompt-injection instructions found in repository content

## Initial scope
The first Dola Seed Studio integration is intentionally review-only: Plan, Edit, Review, and Debug can request a result from Aurora but do not automatically modify a repository.

## Later scope
Add authenticated workspace operations only after sandboxing, approvals, audit logging, and regression tests are in place.
