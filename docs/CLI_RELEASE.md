# Publishing the Aurora CLI to npm

The CLI source lives in [`cli/`](../cli). It is a zero-dependency Node ≥18 package.

## One-time setup

1. Create an npm account at <https://www.npmjs.com/signup>.
2. Locally:
   ```bash
   cd cli
   npm login
   ```
3. Reserve the package name (if `aurora-studio` is taken, edit `cli/package.json` → `name` and the `npm install -g <name>` example in `cli/README.md`).

## Release a new version

From the repo root:

```bash
cd cli
# bump version (patch | minor | major)
npm version patch

# dry-run to confirm what will be published
npm publish --dry-run

# publish for real
npm publish --access public
```

Then verify:

```bash
npm view aurora-studio
npx aurora-studio version
```

## Install command users will run

```bash
npm install -g aurora-studio
aurora login
aurora generate --prompt "neon street performance" --out shot.png
```

## CI release (optional)

Add an `NPM_TOKEN` repo secret (Automation token), then a workflow:

```yaml
# .github/workflows/release-cli.yml
on:
  push:
    tags: ['cli-v*']
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', registry-url: 'https://registry.npmjs.org' }
      - run: npm publish --access public
        working-directory: cli
        env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }
```

Tag and push to release:

```bash
git tag cli-v0.1.0 && git push origin cli-v0.1.0
```

## Verify the install end-to-end

```bash
# Fresh shell / machine
npm install -g aurora-studio
aurora version           # → 0.1.0
aurora help              # → full command list
aurora login             # paste a real key from /dashboard
aurora generate --prompt "subject on a rooftop, golden hour" --out test.png
```

If `aurora` isn't on PATH after install, ensure your npm global `bin` is on PATH (`npm config get prefix`).
