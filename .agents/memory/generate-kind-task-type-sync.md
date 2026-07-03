---
name: GenerateKind must be a TaskType
description: Adding a new GenerateKind to the orchestrator requires a matching addition to TaskType in inference/types.ts, or the build breaks with a non-obvious error far from the actual change.
---

`orchestrator.server.ts`'s `toInferenceInput` narrows an incoming
`GenerateKind` down to the `TaskType` union defined in
`src/lib/inference/types.ts` for the env-based inference/ backend layer. The
two unions are declared independently — `TaskType` is NOT derived from
`GenerateKind` — so adding a new kind (e.g. `lyric_video`, `autocut`) only to
the `GenerateKind` union compiles fine at the call site but fails with a
TS2322 assignability error inside `toInferenceInput`, often on an unrelated
line, which can look like a pre-existing bug rather than a direct consequence
of the new kind.

**Why:** this split happened because `inference/types.ts` predates some
`GenerateKind` additions and nobody enforces the two lists stay identical;
the compiler only catches the gap at the narrowing call site, not at the
`GenerateKind` declaration itself.

**How to apply:** whenever adding a new `GenerateKind`, immediately grep for
`TaskType` in `src/lib/inference/types.ts` and add the new kind there too if
the kind can ever reach the env inference/ backend path (i.e. isn't strictly
self-hosted-GPU-only in every routing branch). Run `tsc` after adding a kind,
not just the test suite — this class of error is TS-only and won't show up
in `bun test`.
