#!/bin/bash
set -e

# Install dependencies (picks up any package.json changes from the merge).
bun install
