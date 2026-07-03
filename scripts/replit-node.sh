#!/usr/bin/env bash
# Resolve a real, WORKING Node binary, then exec it with the given args.
#
# This app's SSR build/runtime must run under REAL Node — Bun napi-panics on it.
#
# Pitfalls that have each caused an opaque "exit 127" in production and must
# not be reintroduced:
#   - `available-pid2-node-paths` is a dev-sandbox-only helper. It does not
#     exist in the production autoscale/deploy image.
#   - `command -v node` is NOT safe to trust blindly: this workspace's PATH
#     can include `.pythonlibs/bin/node`, a symlink into a Nix store path
#     that is specific to the *dev sandbox's* Nix closure
#     (e.g. /nix/store/<hash>-nodejs-22.22.0/bin/node). That exact store path
#     does not exist in the production container's closure, so the symlink
#     resolves to nothing there — `-x` still reports it as "executable" (it's
#     a valid symlink) but exec fails with "required file not found" (exit
#     127). Checking `-x` on a symlink is NOT sufficient; the candidate must
#     actually be invoked to prove it works.
#
# To keep both the dev sandbox and production deploys working, gather
# candidates in order of preference and use the FIRST ONE THAT ACTUALLY RUNS:
#   1. `node` on PATH (the deploy image provides nodejs-24 via the Nix module;
#      the --version probe rejects the broken .pythonlibs symlink case)
#   2. the dev-sandbox `available-pid2-node-paths` helper, if it exists
#   3. a version-sorted glob for nodejs Nix store packages, NEWEST first
#      (last resort only: the store can contain many unrelated/ancient node
#      versions — e.g. node 10.x or GraalVM builds — and Vite 7 requires
#      Node ^20.19 || >=22.12, so an arbitrary store pick is NOT safe)
# If none of these produce a binary that actually executes, fail loudly with
# a clear message instead of a silent/opaque exit 127.
set -uo pipefail

is_working_node() {
  local candidate="$1"
  [ -n "${candidate}" ] && [ -x "${candidate}" ] && "${candidate}" --version >/dev/null 2>&1
}

NODE_BIN=""

path_node="$(command -v node 2>/dev/null || true)"
if is_working_node "${path_node}"; then
  NODE_BIN="${path_node}"
fi

# available-pid2-node-paths is a dev-sandbox-only helper (not present in the
# production/autoscale container) — only call it if it actually exists,
# otherwise it would abort this script with a bare "command not found".
if [ -z "${NODE_BIN}" ] && command -v available-pid2-node-paths >/dev/null 2>&1; then
  while IFS= read -r candidate; do
    if is_working_node "${candidate}"; then
      NODE_BIN="${candidate}"
      break
    fi
  done < <(available-pid2-node-paths 2>/dev/null || true)
fi

# Last resort: search the Nix store directly. Sort candidates by their
# embedded version number, NEWEST first, so we never pick an ancient node
# just because its store hash sorts earlier. `sort -V` on the version
# segment handles multi-digit versions correctly (22.12 > 22.2).
if [ -z "${NODE_BIN}" ]; then
  while IFS= read -r candidate; do
    if is_working_node "${candidate}"; then
      NODE_BIN="${candidate}"
      break
    fi
  done < <(
    for p in /nix/store/*-nodejs-*/bin/node; do
      [ -e "${p}" ] || continue
      ver="${p#*-nodejs-}"
      ver="${ver%%/*}"
      printf '%s\t%s\n' "${ver}" "${p}"
    done | sort -rV | cut -f2
  )
fi

if [ -z "${NODE_BIN}" ]; then
  echo "FATAL: scripts/replit-node.sh could not resolve a WORKING Node.js binary." >&2
  echo "  - 'node' on PATH (possibly via .pythonlibs/bin/node) was missing or did not run." >&2
  echo "  - The dev-sandbox 'available-pid2-node-paths' helper was unavailable or returned nothing usable." >&2
  echo "  - No nodejs Nix store package under /nix/store/*-nodejs-*/bin/node actually ran." >&2
  echo "  Ensure the 'nodejs-24' module is declared in .replit and available in this environment." >&2
  exit 1
fi

exec "${NODE_BIN}" "$@"
