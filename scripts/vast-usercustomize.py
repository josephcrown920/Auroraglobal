"""Aurora workspace hook: expose VASTAI_API_KEY to the official Vast.ai tools.

Installed by scripts/setup-vast-tools.sh as
.pythonlibs/lib/python3.11/site-packages/usercustomize.py (Python imports a
`usercustomize` module from the user site-packages at interpreter start-up).

The official Vast.ai CLI and SDK only read VAST_API_KEY (or a key file written
by `vastai set api-key`). Aurora keeps the key in the VASTAI_API_KEY secret, so
this maps the *name* inside the current process only: nothing is printed,
written to disk, or committed, and an explicit VAST_API_KEY always wins.
"""

import os

if "VAST_API_KEY" not in os.environ and os.environ.get("VASTAI_API_KEY"):
    os.environ["VAST_API_KEY"] = os.environ["VASTAI_API_KEY"]
