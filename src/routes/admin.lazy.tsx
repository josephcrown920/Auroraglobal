import { createLazyFileRoute, Outlet } from "@tanstack/react-router";
import { AdminRouteBoundary } from "@/components/AdminRouteBoundary";

/**
 * Layout for the whole /admin* subtree. Every child page (overview at
 * "/admin/", ledger, orchestration, …) renders inside the boundary, which
 * waits for the server-verified admin check and sends everyone else away.
 */
export const Route = createLazyFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  return (
    <AdminRouteBoundary>
      <Outlet />
    </AdminRouteBoundary>
  );
}