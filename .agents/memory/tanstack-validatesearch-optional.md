---
name: TanStack Router validateSearch must return all-optional types
description: Adding validateSearch to an existing route breaks every <Link> to it unless the return type is explicitly all-optional
---

When adding `validateSearch` to an existing route (e.g. for deep-link prefill params), annotate the return type explicitly with ALL-OPTIONAL props:

```ts
validateSearch: (search: Record<string, unknown>): { prompt?: string; image?: string } => ...
```

**Why:** without the explicit annotation, TypeScript infers a required-prop shape and every existing `<Link to="/that-route">` anywhere in the app fails TS2741 demanding a `search` prop — a single-route change becomes an app-wide type break.

**How to apply:** any time a search-param schema is added or extended on a route that other pages already link to. Also validate values defensively at runtime (e.g. https-only URLs, length caps) since search params are attacker-controlled.
