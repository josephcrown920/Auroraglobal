const SESSION_KEY_PREFIX = "aurora.studio_session.v3.";

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

function sessionKey(userId: string): string {
  return `${SESSION_KEY_PREFIX}${userId}`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNullableString(value: unknown): string | null | undefined {
  return value === null || typeof value === "string" ? value : undefined;
}

function parseStudioSession(raw: string): StudioSession | null {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  const session: StudioSession = {};

  for (const key of ["prompt", "model", "videoModel", "cameraMovement", "videoPrompt", "lipsyncModel", "videoResolution"] as const) {
    const field = readString(value[key]);
    if (field !== undefined) session[key] = field;
  }
  for (const key of ["activePreset", "selfie", "outfit", "scene", "prop", "motion", "endFrameUrl", "audioUrl"] as const) {
    const field = readNullableString(value[key]);
    if (field !== undefined) session[key] = field;
  }

  return Object.keys(session).length > 0 ? session : null;
}

export function loadStudioSession(userId: string): StudioSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(sessionKey(userId));
    if (!raw) return null;
    const session = parseStudioSession(raw);
    if (!session) localStorage.removeItem(sessionKey(userId));
    return session;
  } catch {
    return null;
  }
}

export function saveStudioSession(userId: string, session: StudioSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(sessionKey(userId), JSON.stringify(session));
  } catch {
    // Ignore quota errors silently
  }
}

export function clearStudioSession(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(sessionKey(userId));
  } catch {
    // ignore
  }
}
