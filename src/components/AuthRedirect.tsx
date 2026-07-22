import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PageSpinner } from "./PageSpinner";

/** Shown when a protected route detects loading=false, user=null.
 *  Immediately navigates to /auth while keeping the spinner visible so there
 *  is no flash of blank content during the redirect. */
export function AuthRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/auth" });
  }, [navigate]);
  return <PageSpinner />;
}
