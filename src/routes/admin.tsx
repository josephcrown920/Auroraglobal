import { createFileRoute } from "@tanstack/react-router";

/**
 * /admin is a LAYOUT route: its component (admin.lazy.tsx) wraps every
 * admin.* child in AdminRouteBoundary and renders an <Outlet />. The overview
 * dashboard itself lives in admin.index.lazy.tsx ("/admin/"). Keep it that
 * way — a page component here (without an Outlet) would swallow every child
 * URL, and a child rendered outside the boundary would skip the admin check.
 */
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Aurora" },
      { name: "description", content: "Aurora internal admin console for operators." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});
