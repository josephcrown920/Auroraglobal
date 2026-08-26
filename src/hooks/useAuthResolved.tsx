import { useAuth } from "@/hooks/use-auth";

export function useAuthResolved() {
  const auth = useAuth();
  // auth.loading means the hook still resolving session; authResolved means
  // the initial resolution has completed (signed-in or signed-out).
  const authResolved = auth ? !auth.loading : true;
  return { ...auth, authResolved };
}
