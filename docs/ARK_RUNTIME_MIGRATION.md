# Ark Runtime SDK migration decision

Aurora Global is a TypeScript/TanStack Start application. The official Ark Runtime SDK repositories currently identified are Python, Go, and Java. The official Python package is `arkruntime`; the official Go package is `github.com/volcengine/ark-runtime-go`; the official Java artifact is `com.volcengine:ark-runtime`.

Do **not** add the Python `arkruntime` package to Aurora's Node dependency tree. Introducing a Python runtime solely for Ark calls would be a regression in the current architecture.

## Current Aurora approach

Aurora's BytePlus/ModelArk integration remains a server-only HTTP integration using the documented Ark REST interface. This is appropriate for the TypeScript runtime.

## Migration gate

If Volcengine publishes an official Node/TypeScript Ark Runtime SDK with coverage for Aurora's APIs, evaluate it in an isolated branch:

1. Install the latest stable release.
2. Record the exact resolved version.
3. Compare API coverage with Aurora's existing REST calls.
4. Validate the configured AP-Southeast endpoint and current account resources.
5. Validate synchronous requests, streaming, error handling, retries, and resource cleanup.
6. Keep REST/legacy implementations for APIs the SDK does not cover.
7. Pin the validated version before production adoption.

Never copy historical model IDs, inference endpoint IDs, or file IDs from documentation into production. Validate resources against the current account.

## Current status

- Python SDK: available.
- Go SDK: available.
- Java SDK: available.
- Official Node/TypeScript Ark Runtime SDK: not currently identified.
- Aurora Node integration: keep the existing REST implementation until an official Node SDK exists or the runtime architecture changes.
