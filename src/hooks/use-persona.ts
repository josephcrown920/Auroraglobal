/**
 * Persists the user's persona choice ("artist" | "creator") in localStorage.
 * Null means the user has not yet chosen — show PersonaGate.
 */
import { useCallback, useEffect, useState } from "react";

export type Persona = "artist" | "creator";
const STORAGE_KEY = "aurora-persona";

export function usePersona() {
  const [persona, setPersonaState] = useState<Persona | null>(() => {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "artist" || v === "creator" ? v : null;
  });

  // Hydrate from localStorage after SSR
  useEffect(() => {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "artist" || v === "creator") setPersonaState(v);
  }, []);

  const setPersona = useCallback((p: Persona) => {
    localStorage.setItem(STORAGE_KEY, p);
    setPersonaState(p);
  }, []);

  const clearPersona = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setPersonaState(null);
  }, []);

  return { persona, setPersona, clearPersona };
}
