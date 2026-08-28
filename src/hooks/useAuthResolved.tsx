import { useAuth } from "@/hooks/use-auth";

export function useAuthResolved() {
  const auth = useAuth();
  // auth.loading means the hook is still resolving the session. authResolved
  // means initial resolution has completed, whether signed in or signed out.
  const authResolved = !auth.loading;

  return { ...auth, authResolved };
}
