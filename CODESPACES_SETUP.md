# Codespaces & Prebuilds — Quick notes for repo administrators

This repository now includes a devcontainer and helper scripts to make Codespaces and local devcontainers reproducible and fast.

Files added on branch `codespace-setup`:
- .devcontainer/devcontainer.json
- .devcontainer/Dockerfile
- scripts/post-create.sh
- scripts/export-vscode-config.sh
- dotfiles/install.sh

What you should do next (repo admin / owner):

1) Review the branch `codespace-setup` and open a pull request to merge into your main branch.

2) Enable Codespaces Prebuilds (recommended):
   - Go to the repository → Settings → Codespaces → Prebuilds.
   - Enable prebuilds for the branch you want (e.g., main).
   - Optionally configure a schedule or on-push triggers. Prebuilds speed up new Codespace creation by prebuilding the devcontainer image.

3) Optional: publish a container image to GHCR for even faster starts:
   - Build the image locally: `docker build -t ghcr.io/<owner>/auroraglobal:dev -f .devcontainer/Dockerfile .`
   - Push: `docker push ghcr.io/<owner>/auroraglobal:dev`
   - Edit .devcontainer/devcontainer.json to use the `image` field instead of `build`.

4) VS Code export/import:
   - Developers can run `bash scripts/export-vscode-config.sh` locally to create a zip of their settings, keybindings, snippets, and extensions list.
   - Alternatively, use VS Code Settings Sync or Profiles (recommended) to keep settings synced across machines.

Security note: Do not add secrets (API keys, private certs, SSH private keys) to the repository. Use GitHub Secrets for CI and Codespaces secrets for Codespaces.
