---
name: Director Room Nitro build budget
description: Resource behavior when exposing the heavy storyboard workspace through another TanStack route.
---

In this flat TanStack/Nitro app, a second route that statically imports the heavy storyboard workspace can make the production Nitro transform exhaust the shared 7.8GB build container. Keeping the route shell light and loading the workspace through a client-side dynamic import preserves the same hydrated UI while allowing the production build to complete.

**Why:** The client build and typecheck succeeded, but repeated production builds were terminated during the second Nitro transform while memory was nearly exhausted. Moving the workspace behind the route-level dynamic import produced a clean production build and a separate workspace chunk.

**How to apply:** For additional client-only routes that reuse this storyboard workspace, keep the route module lightweight and dynamically import the workspace component rather than adding another static import to the SSR graph. Verify both hydration and the production build after changing the route boundary.