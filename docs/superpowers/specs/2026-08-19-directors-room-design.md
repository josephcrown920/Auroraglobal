# Directors Room Promotion and Reliability Design

**Date:** 2026-08-19  
**Status:** Approved for specification review  
**Scope:** Promote the existing storyboard studio into the single canonical Directors Room web experience.

## Product identity

Aurora has one Directors Room product surface:

- `/director-room` is the canonical functional workspace.
- `/directors-board` remains a compatibility entry point and redirects to `/director-room`.
- Navigation, page copy, and visible labels use **Director Room** consistently.
- Existing API paths containing `directors-board` remain internal implementation names in this release. They are not a second product surface.
- No new web artifact or second mobile app is created for this work. “Builds” means the feature implementation plus development, production, and end-to-end verification.

The existing Android AAB remains a separate release track.

## Existing foundation

The implementation extends the current storyboard studio rather than replacing it:

- `StudioPage` owns the workspace shell and board interactions.
- `FlowCanvas` and `Timeline` provide the shot graph and ordered sequence.
- `Inspector` edits a shot, uploads a frame, and generates a still.
- `CharactersPanel` manages cast references and generates character sheets.
- `DirectorChat` streams suggestions and accepts proposed shots.
- `VideoAgentPanel` queues render jobs and polls their terminal state.
- `WorkersPanel` exposes GPU worker status.
- `board-store` owns the board model and browser persistence.
- `render-jobs` owns the Supabase render-job boundary.

## Routing design

1. Make the `/director-room` lazy route render the existing `StudioPage`.
2. Move the current marketing-only Director Room content out of the functional route. Product messaging can remain in navigation or a separate marketing surface, but `/director-room` must open the workspace.
3. Change `/directors-board` to a compatibility redirect using the existing router conventions. It must not load a second studio implementation.
4. Update visible navigation and internal calls-to-action that still identify the product as Directors Board.
5. Preserve existing API route names unless a caller contract requires a deliberate alias or migration.

## Workspace and data flow

### Board state

The board remains the source of truth for this release and continues to persist to `localStorage`:

- The existing board ID remains stable for the lifetime of the board and is passed to render jobs.
- Board edits, accepted proposals, generated still URLs, and completed video URLs update board state immediately.
- The UI continues to state that the board is saved to the current browser. Cross-device/server-persisted projects are explicitly out of scope.

### Director collaboration

`DirectorChat` continues to use the streaming Directors Board chat endpoint:

- It sends the current ordered board context.
- A proposal is not applied automatically.
- Accepting a proposal adds a shot, selects it, and returns focus to the canvas.
- Later prompts see the updated board context.

### Still generation

Inspector and character-sheet generation use one intentional Directors Room image contract:

- Align callers with the supported Directors Room image endpoint rather than leaving Inspector and Characters on a potentially dead `/api/generate-image` path while the route-specific endpoint is `/api/directors-board/generate-image`.
- Preserve `streamImage` support for either a JSON URL response or an SSE response.
- Only save a URL after a valid final image result.
- Keep partial previews local to the active panel until completion.
- Map credit exhaustion, rate limiting, missing output, provider failures, and malformed responses to visible actionable errors.
- After success, the URL must remain visible when switching tabs and after reloading the same browser.

### Video generation

Video nodes continue to use the existing render-job and GPU-worker contracts:

- Queue requests include board ID, shot ID, model, prompt, optional still input, duration, and FPS.
- The selected shot stores the created job ID and clears stale video output when a new job starts.
- Polling is scoped to the selected shot, cleans up on unmount, and stops on `completed`, `failed`, or a polling error.
- A completed output URL is written back to the shot and rendered in the inspector.
- Queue, worker, and provider failures remain visible in the video panel.
- Duplicate queue submissions are disabled while a request is active.

### Export

ZIP export remains a board-level action:

- It exports the current board and available generated media.
- It reports missing or failed media explicitly instead of silently presenting an apparently complete archive.
- Export controls show a busy state and cannot be submitted twice concurrently.

## Reliability and error handling

- Preserve provider error text sufficiently for existing Aurora toast/error classification.
- Every asynchronous action has a visible loading state and a visible failure state.
- Do not write blank or stale URLs after failed/partial responses.
- Polling timers and streaming readers are cleaned up when the active component changes or unmounts.
- Chat, image generation, render queueing, and export prevent duplicate submissions while busy.
- The canonical room must remain usable when one generation surface fails; an image failure must not disable the board, and a video-job failure must not hide existing stills.
- No silent fallback to a different product route or second studio is permitted.

## Verification plan

Verification must confirm visible behavior, not only HTTP success:

1. Open `/director-room` and confirm the workspace visibly renders.
2. Open `/directors-board` and confirm it lands on the same canonical room.
3. Verify desktop and mobile layout behavior for canvas, inspector, chat, characters, and GPU tabs.
4. Verify a streamed Director response can produce a proposal and accepting it creates/selects a shot.
5. Verify still-generation success and failure states for a shot and character sheet.
6. Verify queueing, polling, terminal success, and terminal failure for a video node.
7. Verify ZIP export busy/success behavior and explicit handling of missing/failed media.
8. Run the relevant typecheck, lint, unit/MCP tests, Playwright tests, and production web build.
9. Restart the relevant workflow after changes, inspect logs, and capture a final preview.

## Scope boundaries

This release does not include:

- a second Directors Room route or artifact,
- server-persisted boards or projects,
- a new mobile Directors Room implementation,
- finishing, lipsync, or Aurora Soul work,
- a new Android AAB.

Those can be planned separately after the canonical web room is reliable.