import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { authNextSearch } from "@/lib/auth-return-path";
import { PageSpinner } from "./PageSpinner";

/** Shown when a protected route detects loading=false, user=null.
 *  Immediately navigates to /auth while keeping the spinner visible so there
 *  is no flash of blank content during the redirect.
 *
 *  Passes the current page (path + query + hash) as `next=` so the user
 *  returns to their intended destination after sign-in — not just the
 *  default /studio landing. */
export function AuthRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/auth", search: authNextSearch() });
  }, [navigate]);
  return <PageSpinner />;
}
