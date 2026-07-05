# Aurora Studio CLI

Generate cinematic music-video shots from your terminal.

## Install

```bash
npm install -g aurora-studio
```

Or run once without installing:

```bash
npx aurora-studio generate --prompt "subject on a rooftop, golden hour, anamorphic"
```

## Quick start

```bash
aurora login                                        # paste API key from dashboard
aurora generate --prompt "neon street scene" --out shot.png
aurora whoami
aurora help
```

## Commands

| Command | Description |
|---|---|
| `aurora login` | Save your API key to `~/.aurora/config.json` |
| `aurora generate --prompt "..." [--out file.png]` | Render a shot |
| `aurora whoami` | Show the active account |
| `aurora version` | Print CLI version |
| `aurora help` | Show help |

## Environment

- `AURORA_API_BASE` — override the API base (default: `https://aurora-sparkle-charm.lovable.app`)

## Get an API key

Open [your dashboard](https://aurora-sparkle-charm.lovable.app/dashboard) and copy your key, or just run `aurora login` and approve in the browser.

## License

MIT
