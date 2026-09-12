# Ark Runtime SDK migration decision

Aurora Global is a TypeScript/TanStack Start application. The current official Ark Runtime SDK repositories cover Python, Go, and Java; an official TypeScript/Node Ark Runtime SDK was not found in the current official Volcengine SDK repositories.

Therefore **do not add `arkruntime` to Aurora's Node dependency tree**. `arkruntime` is the official Python package and would require introducing a separate Python runtime solely for Ark calls.

## Current Aurora approach

Aurora's BytePlus/ModelArk integration uses a server-only HTTP client and the documented Ark REST endpoints. This is appropriate for the current TypeScript runtime and keeps the provider integration inside the existing orchestration layer.

## Migration rule

When Volcengine publishes an official Node/TypeScript Ark Runtime SDK with coverage for the APIs Aurora uses, evaluate it in an isolated branch first:

1. Install the latest stable release.
2. Record the exact resolved package version.
3. Compare supported APIs against Aurora's existing REST calls.
4. Validate authentication and the configured AP-Southeast endpoint.
5. Validate synchronous requests, streaming, error handling, retries, and resource cleanup where applicable.
6. Keep REST calls for capabilities the SDK does not cover.
7. Pin the validated version before production adoption.

## Capability boundaries already relevant to Aurora

The official migration guidance says the new SDK and legacy SDK can coexist during migration. In particular, legacy Context Cache and Bot APIs remain outside the new SDK's current coverage, so those should remain on the legacy implementation or REST API until separately validated.

## Important resource rule

Do not copy historical model IDs, inference endpoint IDs, or file IDs from documentation into Aurora. Model activation and resource ownership must be validated against the current Aurora/BytePlus account.

## Current status

- Official Python SDK: available (`arkruntime`).
- Official Go SDK: available (`github.com/volcengine/ark-runtime-go`).
- Official Java SDK: available (`com.volcengine:ark-runtime`).
- Official TypeScript/Node Ark Runtime SDK: **not currently identified**.
- Aurora Node integration: keep the existing server-side REST implementation until an official Node SDK exists or the application runtime changes.
