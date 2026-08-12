import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { FeatureGuard } from "@/components/FeatureVisibilityProvider";
import { ArrowLeft } from "lucide-react";
import NexusArbEngine from "@/components/nexusarb/NexusArbEngine";

/**
 * Standalone, isolated NexusARB trading-simulation page.
 *
 * This route is intentionally decoupled from Aurora: it renders the vendored
 * engine with only a slim "back to Aurora" bar and a prominent
 * simulation/educational label. It uses no Aurora auth, credits, or media.
 */
// Artist-only mode: this feature is hidden from regular users by default.
// Admins always pass; regular users are redirected to /studio unless the
// owner has toggled the feature visible (see feature-visibility registry).
export const Route = createLazyFileRoute("/nexusarb")({
  component: () => (
    <FeatureGuard feature="nexusarb">
      <NexusArbPage />
    </FeatureGuard>
  ),
});

function NexusArbPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          padding: "8px 14px",
          fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
          background: "rgba(0,0,0,0.55)",
          borderBottom: "1px solid rgba(0,255,136,0.12)",
        }}
      >
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            letterSpacing: 1,
            color: "#9fb3c8",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={13} /> BACK TO AURORA
        </Link>
        <span style={{ fontSize: 9, letterSpacing: 2, color: "#ff8800" }}>
          ◎ SIMULATION · PAPER TRADING · EDUCATIONAL ONLY — NO REAL ORDERS OR WITHDRAWALS
        </span>
      </div>
      <NexusArbEngine />
    </div>
  );
}
