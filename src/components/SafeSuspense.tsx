import React, { Suspense, ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export function GlobalSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-center">
        <div className="h-8 w-48 bg-muted rounded mb-3" />
        <div className="h-4 w-64 bg-muted rounded" />
      </div>
    </div>
  );
}

export function SafeSuspense({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={fallback ?? <GlobalSkeleton />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default SafeSuspense;
