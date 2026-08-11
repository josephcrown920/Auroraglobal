// Redirect /aurora-adult (no trailing slash) → /aurora-adult/ (the artifact).
// Without this, the main proxy's 307 redirect lands on a TanStack route that
// doesn't exist, producing an Internal Server Error on mobile.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/aurora-adult")({
  beforeLoad: () => {
    throw redirect({ href: "/aurora-adult/", statusCode: 301 });
  },
});
