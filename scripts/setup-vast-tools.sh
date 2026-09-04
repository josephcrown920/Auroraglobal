#!/usr/bin/env bash
# Install (or upgrade) the official Vast.ai CLI + Python SDK in this workspace.
#
# Idempotent — safe to re-run at any time. It:
#   1. retires the old `uv tool install vastai` copy (.local/share/uv + dangling
#      .local/bin launchers that were never on PATH),
#   2. installs the PyPI package `vastai` (CLI *and* SDK; `vastai-sdk` is a
#      deprecated alias) into the persistent .pythonlibs via the workspace pip
#      wrapper — `uv add` targets the read-only Nix site-packages here,
#   3. installs the usercustomize.py hook that lets `vastai ...` and
#      `VastAI()` read the VASTAI_API_KEY secret (the tools only know
#      VAST_API_KEY) — an in-process name mapping, no key is stored anywhere,
#   4. verifies the CLI and the SDK import.
#
# Usage:
#   bash scripts/setup-vast-tools.sh                         # pinned, verified release (see below)
#   VASTAI_VERSION=1.7.0 bash scripts/setup-vast-tools.sh    # a specific other release
#   VASTAI_VERSION=latest bash scripts/setup-vast-tools.sh   # newest on PyPI (deliberate upgrade)
set -euo pipefail

# Pinned so a repair/reinstall reproduces the verified toolchain instead of
# silently pulling a new upstream release. Bump deliberately after re-running
# the read-only checks in docs/VAST_TOOLS.md.
VASTAI_VERSION="${VASTAI_VERSION:-1.6.0}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v pip >/dev/null 2>&1; then
  echo "pip wrapper not found on PATH — run this from the Replit workspace shell" >&2
  exit 1
fi

# 1. Retire the stale uv-tool install.
if command -v uv >/dev/null 2>&1 && uv tool list 2>/dev/null | grep -q '^vastai '; then
  echo "Removing stale 'uv tool' copy of vastai..."
  uv tool uninstall vastai
fi
rm -rf "$ROOT/.local/share/uv/tools/vastai"
for link in "$ROOT/.local/bin/vastai" "$ROOT/.local/bin/serve-vast-deployment"; do
  if [[ -L "$link" || -e "$link" ]]; then
    rm -f "$link"
  fi
done
if [[ -d "$ROOT/.local/bin" ]]; then
  rmdir "$ROOT/.local/bin" 2>/dev/null || true   # only if now empty
fi
# ...and the unpacked vastai wheels uv left behind in its archive cache.
for d in "$ROOT"/.cache/uv/archive-v0/*/; do
  if [[ -d "$d" ]] && compgen -G "${d}vastai-*.dist-info" >/dev/null; then
    rm -rf "$d"
  fi
done

# 2. Install into .pythonlibs.
if [[ "$VASTAI_VERSION" == "latest" ]]; then
  echo "Installing the newest vastai release into .pythonlibs..."
  pip install --quiet --upgrade vastai
else
  echo "Installing vastai==${VASTAI_VERSION} into .pythonlibs..."
  pip install --quiet "vastai==${VASTAI_VERSION}"
fi

# 3. Install the VASTAI_API_KEY -> VAST_API_KEY hook into the user site-packages.
USER_SITE="$(python3 -c 'import site; print(site.getusersitepackages())')"
HOOK_SRC="$ROOT/scripts/vast-usercustomize.py"
HOOK_DST="$USER_SITE/usercustomize.py"
MARKER="Aurora workspace hook: expose VASTAI_API_KEY"
if [[ -L "$HOOK_DST" ]]; then
  echo "refusing to write through a symlink at $HOOK_DST — remove it and re-run" >&2
  exit 1
fi
if [[ -e "$HOOK_DST" ]] && ! grep -q "$MARKER" "$HOOK_DST"; then
  echo "refusing to overwrite an unrelated $HOOK_DST — merge scripts/vast-usercustomize.py into it by hand" >&2
  exit 1
fi
mkdir -p "$USER_SITE"
cp "$HOOK_SRC" "$HOOK_DST"

# 4. Verify.
VASTAI_BIN="$ROOT/.pythonlibs/bin/vastai"
if [[ ! -x "$VASTAI_BIN" ]]; then
  echo "expected $VASTAI_BIN after install, but it is missing" >&2
  exit 1
fi
echo "vastai CLI: $("$VASTAI_BIN" --version)"
python3 -c 'from vastai import VastAI; print("vastai SDK: import OK")'
if [[ -n "${VASTAI_API_KEY:-}" ]]; then
  python3 -c 'import os, sys; sys.exit(0 if os.environ.get("VAST_API_KEY") else 1)' \
    && echo "API key hook: VASTAI_API_KEY is visible to the tools as VAST_API_KEY" \
    || { echo "API key hook did not take effect (is the user site disabled?)" >&2; exit 1; }
else
  echo "API key hook installed (VASTAI_API_KEY is not set in this shell, so only unauthenticated commands will work)"
fi

cat <<'EOF'

Done. Try:
  vastai --version
  vastai search offers 'gpu_ram>=16 rentable=true' --limit 5 --raw
See docs/VAST_TOOLS.md for SDK usage and the guardrails on renting instances.
EOF
