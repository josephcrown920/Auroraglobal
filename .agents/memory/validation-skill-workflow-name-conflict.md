---
name: Validation skill name conflicts with existing shell workflow
description: setValidationCommand fails with PROHIBITED_ACTION if a non-validation workflow already has that name; must removeWorkflow first.
---

`setValidationCommand({ name, command })` upserts cleanly UNLESS a workflow with
the same name already exists as a plain (non-validation) `.replit` workflow —
e.g. a pre-existing "test" workflow created directly via `.replit` / the
workflows skill rather than through the validation skill. In that case it
throws `PROHIBITED_ACTION: "<name>" already exists as a non-validation workflow
and cannot be switched to a validation workflow`.

**Why:** validation commands and regular workflows share the same underlying
`.replit` `[[workflows.workflow]]` namespace, but the platform won't silently
reclassify one into the other.

**How to apply:** if registration fails this way, call
`removeWorkflow({ name })` (from the `workflows` skill) on the conflicting
plain workflow first, then retry `setValidationCommand`. Safe to do even if
the command string is identical — the validation version replaces it.
