import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { trackPageView } from "@/lib/tracking";

/** Mount once at the root — emits page_view on every route change. */
export function usePageViewTracking() {
  const router = useRouter();
  useEffect(() => {
    // initial
    trackPageView(router.state.location.pathname);
    const unsub = router.subscribe("onResolved", ({ toLocation }) => {
      trackPageView(toLocation.pathname);
    });
    return () => unsub();
  }, [router]);
}
