import { supabase } from "@/integrations/supabase/client";
import { getEmbedHostOrigin } from "@/lib/embedFrame";

export type EmbedSsoStatus = "idle" | "pending" | "authenticated" | "error";

const SSO_ENDPOINT = "/api/public/embed-session";

/** Reads the SSO token from the embed URL (?sso=... or #sso=...). */
export function readSsoTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const search = new URLSearchParams(window.location.search);
  const fromSearch = search.get("sso");
  if (fromSearch) return fromSearch;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hash.get("sso");
}

/** Strips the token from the visible URL once it has been consumed. */
export function scrubSsoTokenFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("sso");
  if (url.hash.includes("sso=")) url.hash = "";
  window.history.replaceState({}, "", url.toString());
}

/**
 * Exchanges a host-signed SSO token for a real session inside the embed.
 * Returns true when the embed ends up authenticated.
 */
export async function signInWithEmbedToken(token: string): Promise<boolean> {
  const hostOrigin = getEmbedHostOrigin();
  if (!hostOrigin || token.length === 0 || token.length > 8192) return false;

  const response = await fetch(SSO_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, hostOrigin }),
  });

  if (!response.ok) return false;

  const { email, tokenHash } = (await response.json()) as {
    email?: string;
    tokenHash?: string;
  };
  if (!email || !tokenHash) return false;

  const { error } = await supabase.auth.verifyOtp({
    email,
    token_hash: tokenHash,
    type: "email",
  });

  return !error;
}

/** True when a session already exists, so SSO can be skipped. */
export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}
