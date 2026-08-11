#!/usr/bin/env bash
set -euo pipefail

# Simple dotfiles bootstrap. Intended to be used from a dotfiles repo root after cloning to ~/dotfiles
echo "Running dotfiles bootstrap..."

# Install zsh if missing
if ! command -v zsh >/dev/null 2>&1; then
  echo "Installing zsh"
  sudo apt-get update && sudo apt-get install -y zsh
fi

# Install oh-my-zsh if not present
if [ ! -d "$HOME/.oh-my-zsh" ]; then
  echo "Installing oh-my-zsh"
  sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" || true
fi

# Copy common dotfiles if present
if [ -f ~/dotfiles/.gitconfig ]; then
  cp -v ~/dotfiles/.gitconfig ~/
fi
if [ -f ~/dotfiles/.zshrc ]; then
  cp -v ~/dotfiles/.zshrc ~/
fi

# Run extra bootstrap if provided
if [ -f ~/dotfiles/bootstrap-extra.sh ]; then
  bash ~/dotfiles/bootstrap-extra.sh
fi

echo "Dotfiles bootstrap complete."
