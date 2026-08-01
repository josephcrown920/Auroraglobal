const SESSION_KEY = "aurora.studio_session.v2";

export type StudioSession = {
  prompt?: string;
  model?: string;
  videoModel?: string;
  cameraMovement?: string;
  videoPrompt?: string;
  lipsyncModel?: string;
  videoResolution?: string;
  activePreset?: string | null;
  selfie?: string | null;
  outfit?: string | null;
  scene?: string | null;
  prop?: string | null;
  motion?: string | null;
  endFrameUrl?: string | null;
  audioUrl?: string | null;
};

export function loadStudioSession(): StudioSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudioSession;
  } catch {
    return null;
  }
}

export function saveStudioSession(session: StudioSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore quota errors silently
  }
}

export function clearStudioSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
