> ## Documentation Index
> Fetch the complete documentation index at: https://heygen-1fa696a7.mintlify.site/llms.txt
> Use this file to discover all available pages before exploring further.

# Install HeyGen Skills

Install the official HeyGen Skills for AI coding agents, then verify authentication before trying to create avatars, videos, or translations.

The upstream HeyGen skills repo ships three independently installable skills:

- **heygen-avatar** — create and reuse persistent HeyGen avatars.
- **heygen-video** — generate videos, commonly chained after avatar creation.
- **heygen-translate** — localize finished videos.

Most projects should install `heygen-avatar` and `heygen-video` together. Add `heygen-translate` when finished videos need localization.

## Agent-first workflow

If an agent is setting this up for a user, it should first read the official agent bootstrap file and follow its auth checks:

```text
Read https://raw.githubusercontent.com/heygen-com/skills/master/INSTALL_FOR_AGENTS.md
and follow it. Ask me for any API keys you need.
```

Agents should use this auth priority order:

1. **MCP tools**, when HeyGen MCP tools are already available.
2. **HeyGen CLI**, when `heygen` is installed and `heygen auth status` reports an authenticated account.
3. **Raw v3 API**, only when neither MCP nor CLI is available and `HEYGEN_API_KEY` is already present in the environment.

Never ask users to paste API keys into chat. Ask them to set `HEYGEN_API_KEY` in their shell or configure MCP/OAuth instead.

## Step 1 — Install the skills

### Option A: `gh skill install`

Use GitHub CLI v2.90 or newer. Project scope is the default.

```bash
gh skill install heygen-com/skills heygen-avatar
gh skill install heygen-com/skills heygen-video
gh skill install heygen-com/skills heygen-translate
```

For user-wide installation, add `--scope user`. For reproducible installs, pin a release tag:

```bash
gh skill install heygen-com/skills heygen-avatar@v3.1.0 --pin
```

### Option B: ClawHub

Install all HeyGen skills into the agent's default skills directory:

```bash
clawhub install heygen-skills
```

### Option C: OpenClaw plugin

OpenClaw users who want bundled MCP support can install the plugin:

```bash
openclaw plugins install clawhub:@heygen/openclaw-plugin-heygen
```

### Option D: Git clone

Clone the official skills repo into the agent's skills directory. The skills are auto-discovered at `heygen-avatar/SKILL.md`, `heygen-video/SKILL.md`, and `heygen-translate/SKILL.md`.

```bash
# Claude Code
git clone https://github.com/heygen-com/skills.git ~/.claude/skills/heygen-skills

# OpenClaw
git clone https://github.com/heygen-com/skills.git ~/.openclaw/skills/heygen-skills
```

If you are not sure where an agent stores skills, ask the agent where its skills directory is.

## Step 2 — Configure authentication

Pick the transport that matches how the workspace should be billed. The skills auto-detect the available transport.

### CLI + API key

Recommended for agents, CI, and scripts.

1. Create an API key at <https://app.heygen.com/api>.
2. Install the CLI.
3. Export the key in the shell environment.
4. Verify the CLI can see the authenticated account.

```bash
curl -fsSL https://static.heygen.ai/cli/install.sh | bash
export HEYGEN_API_KEY=<your-key>
heygen --version
heygen auth status
```

To persist the key across sessions, add the `export` line to `~/.zshrc`, `~/.bashrc`, or another shell profile. Alternatively, run `heygen auth login` to store credentials at `~/.heygen/credentials`.

If `HEYGEN_API_KEY` is set, the skills use the CLI and do not probe MCP.

### MCP + OAuth

Use MCP when the user wants OAuth and existing HeyGen plan credits instead of direct API-key access.

```bash
# Claude Code
claude mcp add --transport http heygen https://mcp.heygen.com/mcp/v1/
```

The first MCP call opens the OAuth consent flow in a browser. If `HEYGEN_API_KEY` is not set, the skills look for MCP tools automatically.

## Step 3 — Create the first avatar and video

### Create an avatar

Use the **heygen-avatar** skill from either a description or a photo:

```text
Create my HeyGen avatar from this photo: [your photo]
```

The skill creates a persistent digital twin with a voice and saves an `AVATAR-<NAME>.md` file for reuse.

### Make a video

Use the **heygen-video** skill after the avatar exists:

```text
Make a 30-60 second video of me introducing myself, casual tone.
```

The skill writes the script, runs the v3 Video Agent pipeline, and returns a share link.

### Localize the finished video

Use **heygen-translate** for localization:

```text
Translate that video into Spanish and Japanese.
```

## Requirements

- A HeyGen account, authenticated via MCP OAuth or a CLI/API key.
- An AI agent with skill support, such as Claude Code, OpenClaw, Codex, Cursor, or similar.
- No runtime dependencies, packages, or build step for the skills themselves.

## References

- Documentation index: <https://heygen-1fa696a7.mintlify.site/llms.txt>
- Full install reference: <https://github.com/heygen-com/skills/blob/master/INSTALL.md>
- Agent bootstrap: <https://github.com/heygen-com/skills/blob/master/INSTALL_FOR_AGENTS.md>
