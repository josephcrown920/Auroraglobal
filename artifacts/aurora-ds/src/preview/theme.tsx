import { useSyncExternalStore } from 'react';

/**
 * Aurora is a dark-first brand: the preview boots in dark mode so the system
 * reads the way the product actually ships. The toggle exists to audit the
 * light set. Choice persists per browser.
 */
export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'aurora-ds-theme';
const listeners = new Set<() => void>();

function readInitial(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

let current: Theme = readInitial();

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

apply(current);

export function setTheme(theme: Theme) {
  current = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private browsing — the theme simply won't persist.
  }
  apply(theme);
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, () => current);
  return [theme, setTheme];
}
