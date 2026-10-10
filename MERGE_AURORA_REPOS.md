# Aurora repos merge plan

This branch is for integrating the following repos into `Auroraglobal` without destroying the existing application layout:

- `josephcrown920/cosmic-aurora-play`
- `josephcrown920/aurora-companion-hub`

## Strategy

Use `git subtree` to merge each repo under an app folder instead of flattening the root repo.

- `apps/cosmic-aurora-play`
- `apps/aurora-companion-hub`

This keeps the main repo as the source of truth while preserving each repository's history and code.

## Important review points

Before finalizing the merge, inspect:

- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `.env.example`
- `.env` (do not merge secrets blindly)
- `bun.lock`
- `src/`
- `workers/`
- `supabase/`
- `scripts/`

## Run the merge

```bash
bash scripts/merge-aurora-repos.sh
```

## After review

```bash
git add .
git commit -m "Merge Aurora repos into apps/"
git push origin merge/aurora-repos
```

Then open a pull request from `merge/aurora-repos` into `Main`.
