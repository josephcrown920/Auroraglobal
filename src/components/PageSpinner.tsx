import auroraLogo from "@/assets/aurora-logo.png.asset.json";

export function PageSpinner() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
        gap: 20,
      }}
    >
      <div style={{ position: "relative" }}>
        <img
          src={auroraLogo.url}
          alt="Aurora"
          width={40}
          height={40}
          style={{ borderRadius: 10, opacity: 0.9 }}
        />
        <span
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: 16,
            border: "2px solid transparent",
            borderTopColor: "oklch(0.72 0.2 300)",
            animation: "aurora-spin 0.9s linear infinite",
          }}
        />
      </div>
      <p
        style={{
          fontSize: 12,
          color: "oklch(0.45 0.02 272)",
          letterSpacing: "0.08em",
          fontFamily: "inherit",
        }}
      >
        AURORA
      </p>
      <style>{`
        @keyframes aurora-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
