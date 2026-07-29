# Purple brand refresh

## Goal

Replace Aurora's red brand and call-to-action visuals with the established
violet accent while preserving red where it communicates an error, destructive
action, recording state, or other semantic status.

## Scope

- Update the shared dark and light theme brand/primary tokens to Aurora violet.
- Update the landing page's hard-coded red selection, CTA, label, tile,
  pricing, border, icon, and glow styles to use the shared primary token.
- Keep `destructive`, validation, recording, and other semantic status colors
  unchanged.
- Do not recolor user-selectable color presets or colors inside media assets.

## Visual direction

Use the existing Aurora violet family centered around OKLCH hue 300. Reuse
`primary`, `shadow-glow`, and `shadow-glow-soft` rather than introducing a
second purple or retaining hard-coded red values.

## Verification

Run lint, typecheck, tests, and the production build. Restart the application
workflow, inspect the landing page preview, and confirm no brand-red literals
remain in the landing page or shared theme. Commit the change and push the
current `Main` branch to GitHub.