import { useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Hidden owner entrance.
 *
 * Two unmarked ways in (both navigate to /admin — server still enforces
 * the admin role via has_role(), so this only helps the legitimate owner):
 *
 *   1. Keyboard:  ⌘/Ctrl + Shift + A   (works on every page)
 *   2. Pointer:   triple-click the very bottom-right 24×24 px corner
 *
 * Nothing is rendered visibly. No nav link, no badge, no console log.
 */
export function AdminHotkey() {
  const router = useRouter();
  const clicks = useRef<number[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        router.navigate({ to: "/admin" });
      }
    };
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
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [router]);

  return null;
}
