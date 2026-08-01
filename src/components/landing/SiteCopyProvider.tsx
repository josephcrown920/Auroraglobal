import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { amIAdmin } from "@/lib/admin.functions";

export type SiteCopyContextValue = {
  /** Live copy overrides fetched from the DB. Falls back to {} if absent. */
  copy: Record<string, string>;
  /** True only for signed-in admins — controls the edit pencil UI. */
  isAdmin: boolean;
  /** Optimistic local update after a successful save so the UI reflects
   *  the change without waiting for a page reload. */
  updateLocalCopy: (key: string, value: string) => void;
  /** Optimistic local delete after an admin resets to the hardcoded default. */
  deleteLocalCopy: (key: string) => void;
};

export const SITE_COPY_REFRESH_EVENT = "site-copy:refresh";

const SiteCopyContext = createContext<SiteCopyContextValue>({
  copy: {},
  isAdmin: false,
  updateLocalCopy: () => {},
  deleteLocalCopy: () => {},
});

export function useSiteCopy() {
  return useContext(SiteCopyContext);
}

/** Returns the live override for `key`, or undefined if none. Use your
 *  local fallback string for the default. */
export function useSiteCopyValue(key: string): string | undefined {
  const { copy } = useContext(SiteCopyContext);
  return copy[key];
}

export function SiteCopyProvider({ children }: { children: ReactNode }) {
  const [copy, setCopy] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const amIAdminFn = useServerFn(amIAdmin);

  // ── Fetch copy overrides from the public API ────────────────────────────
  function loadCopy() {
    fetch("/api/public/site-copy")
      .then((r) => (r.ok ? r.json() : null))
      .then((rows: Array<{ key: string; value: string }> | null) => {
        if (!rows?.length) return;
        const map: Record<string, string> = {};
        for (const row of rows) map[row.key] = row.value;
        setCopy(map);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadCopy();
    const handler = () => loadCopy();
    window.addEventListener(SITE_COPY_REFRESH_EVENT, handler);
    return () => window.removeEventListener(SITE_COPY_REFRESH_EVENT, handler);
  }, []);

  // ── Detect admin status ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      amIAdminFn()
        .then((r) => { if (!cancelled) setIsAdmin(!!r.isAdmin); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  // amIAdminFn is stable (server fn wrapper); suppressing exhaustive-deps here
  // matches the pattern used in AdminLandingEditor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLocalCopy = useCallback((key: string, value: string) => {
    setCopy((prev) => ({ ...prev, [key]: value }));
  }, []);

  const deleteLocalCopy = useCallback((key: string) => {
    setCopy((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  return (
    <SiteCopyContext.Provider value={{ copy, isAdmin, updateLocalCopy, deleteLocalCopy }}>
      {children}
    </SiteCopyContext.Provider>
  );
}
