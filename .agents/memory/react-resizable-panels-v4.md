---
name: react-resizable-panels v4 gotchas
description: v4 API differences that silently collapse layouts (pixel defaultSize, inline height:100%, changed data attrs)
---

The project ships react-resizable-panels **v4** (major rewrite), not the v2 API most shadcn docs assume.

**The rules:**
- `Group` props are `orientation` / `defaultLayout` / `onLayoutChanged` (not `direction` / `onLayout`). `Layout` is `{ [panelId: string]: number }`.
- Numeric `Panel` `defaultSize`/`minSize` are **pixels** in v4. Use percent strings (`defaultSize="58%"`, `minSize="20%"`) for proportional splits — numbers render `flex-basis:58px` and the layout silently collapses.
- `Group` sets inline `height:100%;width:100%` — any height class on the Group itself is overridden. Put sizing on a wrapper div and let the Group fill it.
- v4 emits `data-group` / `data-panel` / `data-separator`, NOT `data-panel-group-direction`. The shadcn wrapper's `data-[panel-group-direction=vertical]:*` selectors are dead in v4; style handles explicitly.

**Why:** all three failures are silent — SSR/CSR render "successfully" with panels collapsed to content height; only a screenshot/DOM inspection revealed it.

**How to apply:** any new ResizablePanelGroup usage (e.g. the /editor playground split) — sized wrapper + percent-string sizes + explicit handle styling; verify visually, not just by build.
