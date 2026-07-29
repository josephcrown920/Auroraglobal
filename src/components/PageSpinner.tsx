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
        <span
          style={{
            display: "flex",
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "oklch(0.60 0.24 293 / 0.15)",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.9,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "var(--primary)",
            }}
          />
        </span>
        <span
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: 16,
            border: "2px solid transparent",
            borderTopColor: "var(--primary)",
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
