import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { requestAdminGate } from "@/components/AdminGate";

/**
 * Hidden owner entrance — no visible link, no console log.
 * Only way in: triple-click the very bottom-right 24×24 px corner.
 * It merely asks the /admin route boundary to show the owner passcode form
 * (instead of redirecting a non-admin away); nothing is unlocked here and the
 * server independently enforces admin authorization on every request.
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
          requestAdminGate();
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
