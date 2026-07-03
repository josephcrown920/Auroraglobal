import { supabase } from "@/integrations/supabase/client";
import { hasBackendEnv } from "@/integrations/backend-config";

const SESSION_KEY = "aurora.session_id";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export async function track(name: string, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!hasBackendEnv()) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from("events").insert({
      name,
      path: window.location.pathname,
      user_id: session?.user?.id ?? null,
      session_id: getSessionId(),
      // Cast to satisfy generated Json type — JSONB accepts any serializable object
      payload: (payload ?? null) as never,
    });
  } catch {
    // tracking failures should never break the app
  }
}

export function trackPageView(path: string) {
  void track("page_view", { url: typeof window !== "undefined" ? window.location.href : path });
}
