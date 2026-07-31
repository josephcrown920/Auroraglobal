---
name: Partial [[ports]] block in .replit breaks the main app
description: A [[ports]] list that omits some local ports causes DIDNT_OPEN_A_PORT; complete the list instead of deleting the block.
---

If `.replit` contains any `[[ports]]` entries, **every** local port in the repl must
be represented. A partial list makes the unmapped services time out with
`DIDNT_OPEN_A_PORT` even though the server starts fine and `curl localhost:<port>`
returns 200.

**Why:** seen twice in this repl. The platform re-generates the `[[ports]]` block
from whatever happened to be listening at container-restart time, so if the main
app was down at that moment it gets written back **without** its own port. Deleting
the block is not durable — it was silently re-added with the same partial list.
Completing the list is.

**How to apply:** when a workflow reports `DIDNT_OPEN_A_PORT` but the same command
run by hand in the shell binds the port in seconds, check `.replit` for `[[ports]]`
before restarting a third time. Add the missing `localPort` entries (any free
`externalPort` from 80/443/3000-3003/4200/5000-5003/6000/6800/8000/8080/8099/9000),
then restart once. `.replit` is guarded against direct edits — write the full TOML
to a temp file and `cp` it over.
