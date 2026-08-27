import type { ReactNode } from "react";
import { Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function GlobalSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-center" aria-label="Loading content">
        <div className="mb-3 h-8 w-48 rounded bg-muted" />
        <div className="h-4 w-64 rounded bg-muted" />
      </div>
    </div>
  );
}

export function SafeSuspense({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary>
      <Suspense fallback={fallback ?? <GlobalSkeleton />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default SafeSuspense;
