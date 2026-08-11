# See https://aka.ms/vscode-remote/devcontainer.json for format details

FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0-20

# Install system deps and Python
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      curl git build-essential python3 python3-pip postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install PNPM (optional) and yarn
RUN corepack enable && corepack prepare pnpm@latest --activate || true

# Create workspace dir and set permissions
RUN mkdir -p /workspace && chown -R vscode:vscode /workspace

# Switch back to vscode user
USER vscode

# Set default shell
SHELL ["/bin/bash", "-lc"]
