import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import NexusArbEngine from "@/components/nexusarb/NexusArbEngine";

/**
 * Standalone, isolated NexusARB trading-simulation page.
 *
 * This route is intentionally decoupled from Aurora: it renders the vendored
 * engine with only a slim "back to Aurora" bar and a prominent
 * simulation/educational label. It uses no Aurora auth, credits, or media.
 */
export const Route = createFileRoute("/nexusarb")({
  component: NexusArbPage,
  head: () => ({
    meta: [
      { title: "NexusARB — Trading Simulation (Educational) · Aurora" },
      {
        name: "description",
        content:
          "NexusARB is a paper-trading simulation that monitors 30+ crypto, forex and commodity pairs with live crypto prices and technical indicators. Educational use only — no real trades or withdrawals.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function NexusArbPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#020408" }}>
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
