import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Hidden owner entrance — no visible link, no console log.
 * Only way in: triple-click the very bottom-right 24×24 px corner.
 * Server independently enforces admin role on every request.
 */
export function AdminHotkey() {
  const router = useRouter();
  const clicks = useRef<number[]>([]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (e.clientX >= w - 24 && e.clientY >= h - 24) {
        const now = Date.now();
        clicks.current = [...clicks.current.filter((t) => now - t < 800), now];
        if (clicks.current.length >= 3) {
          clicks.current = [];
          router.navigate({ to: "/admin" });
        }
      }
    };
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("click", onClick);
    };
  }, [router]);

  return null;
}
