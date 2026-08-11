#!/usr/bin/env bash
set -euo pipefail

OUT="vscode-config-export"
mkdir -p "$OUT"

# Export installed extensions
if command -v code >/dev/null 2>&1; then
  echo "Exporting VS Code extensions list"
  code --list-extensions > "$OUT/extensions.txt" || true
else
  echo "VS Code 'code' CLI not found — skipping extensions export"
fi

# Detect common settings paths
OS="$(uname -s)"
case "$OS" in
  Darwin)
    SETTINGS_DIR="$HOME/Library/Application Support/Code/User"
    ;;
  Linux)
    SETTINGS_DIR="$HOME/.config/Code/User"
    ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT)
    SETTINGS_DIR="$APPDATA/Code/User"
    ;;
  *)
    SETTINGS_DIR="$HOME/.config/Code/User"
    ;;
esac

if [ -d "$SETTINGS_DIR" ]; then
  echo "Copying settings from $SETTINGS_DIR"
  cp -v "$SETTINGS_DIR/settings.json" "$OUT/" 2>/dev/null || true
  cp -v "$SETTINGS_DIR/keybindings.json" "$OUT/" 2>/dev/null || true
  mkdir -p "$OUT/snippets" && cp -r "$SETTINGS_DIR/snippets/" "$OUT/" 2>/dev/null || true
else
  echo "Settings directory not found: $SETTINGS_DIR"
fi

# Zip the export
ZIPNAME="vscode-config-$(date +%Y%m%d_%H%M%S).zip"
zip -r "$ZIPNAME" "$OUT" || true

echo "Exported VS Code config to $ZIPNAME"
