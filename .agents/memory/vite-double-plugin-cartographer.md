---
name: Vite cartographer plugin placement (SSR vs client)
description: Correct placement of replitPlugins/cartographer in vite.config.ts to avoid both double-processing crashes and SSR/client hydration mismatches.
---

# Cartographer plugin placement in vite.config.ts

## The rule
`replitPlugins` (cartographer) must be in the **top-level `plugins:` key ONLY**.  
It must **NOT** also appear in `vite.plugins` (via `extraPlugins`).

```ts
// CORRECT
export default defineConfig({
  plugins: replitPlugins,          // top-level → SSR + client, once each ✓
  vite: {
    plugins: [monacoSsrStub, serverFileClientStub],  // client-only stubs, no cartographer ✓
  },
});

// WRONG — double-processing on client → "Duplicate data-component-name" → "Invalid hook call" crash
export default defineConfig({
  plugins: replitPlugins,
  vite: {
    plugins: [monacoSsrStub, serverFileClientStub, ...replitPlugins],  // cartographer twice!
  },
});

// ALSO WRONG — client-only cartographer → SSR/client attr mismatch → hydration error
export default defineConfig({
  // no top-level plugins:
  vite: {
    plugins: [monacoSsrStub, serverFileClientStub, ...replitPlugins],  // client only!
  },
});
```

## Why: plugin environment coverage in @lovable.dev/vite-tanstack-config

- **Top-level `plugins:`** — applied to **both** the SSR and client Vite environments.
- **`vite.plugins`** — applied to the **client environment only** (not SSR).
- Having the same plugin in both → double-processing on client (duplicate `data-replit-metadata`
  attrs in JSX → esbuild warns → corrupted React element tree → "Invalid hook call" crash).
- Having cartographer in `vite.plugins` only → SSR renders without attributes, client adds them
  → hydration mismatch on every page load → "A tree hydrated but some attributes didn't match".
- Having cartographer in top-level only → SSR and client each process it once → attrs match → clean.

## Diagnostic signals
| Signal | Cause |
|---|---|
| `(client) warning: Duplicate "data-component-name"` in Vite log | Cartographer in both lists (double-processing) |
| `A tree hydrated but some attributes didn't match` for elements with `data-replit-metadata` | Cartographer in `vite.plugins` only (client-only) |
| Only `[vite] connected.` in browser console | Correct — cartographer in top-level only |

## Secondary fixes applied alongside (still in place)
- `src/routes/home.lazy.tsx`: `mounted` guard renders neutral shell on SSR, full auth-gated grid
  only after client mount — prevents hydration mismatch from auth-dependent gallery content.
- `<obj.Member>` JSX patterns aliased to uppercase vars in `home.lazy.tsx` and `ToolSection.tsx`
  (standard React requirement; cartographer can't statically resolve member expressions).
