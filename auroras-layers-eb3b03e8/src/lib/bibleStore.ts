import { useCallback, useEffect, useState } from "react";
import {
  createBible,
  loadActiveBibleId,
  loadBibles,
  saveActiveBibleId,
  saveBible,
  type CharacterBible,
} from "@/lib/characterBible";

const EVENT = "aurora:bibles-changed";

function broadcast() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** Shared, event-synced access to the character bibles across the whole studio. */
export function useBibles() {
  const [bibles, setBibles] = useState<CharacterBible[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setBibles(loadBibles());
    setActiveId(loadActiveBibleId());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(EVENT, refresh);
    return () => window.removeEventListener(EVENT, refresh);
  }, [refresh]);

  const persist = useCallback((bible: CharacterBible) => {
    setBibles(saveBible(bible));
    broadcast();
  }, []);

  const activate = useCallback((id: string | null) => {
    saveActiveBibleId(id);
    setActiveId(id);
    broadcast();
  }, []);

  const create = useCallback(
    (name?: string) => {
      const bible = createBible(name);
      setBibles(saveBible(bible));
      saveActiveBibleId(bible.id);
      setActiveId(bible.id);
      broadcast();
      return bible;
    },
    [],
  );

  const active = bibles.find((b) => b.id === activeId) ?? null;

  return { bibles, active, activeId, persist, activate, create, refresh, broadcast };
}
