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
        gap: 16,
      }}
    >
      {/* Three staggered dots — no rotation, just opacity pulse */}
      <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--primary)",
              animation: `aurora-dot-pulse 1.2s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
      <p
        style={{
          fontSize: 10,
          color: "oklch(0.40 0.02 272)",
          letterSpacing: "0.22em",
          fontFamily: "inherit",
          textTransform: "uppercase",
        }}
      >
        Aurora
      </p>
      <style>{`
        @keyframes aurora-dot-pulse {
          0%, 80%, 100% { opacity: 0.18; transform: scale(0.85); }
          40%            { opacity: 1;    transform: scale(1);    }
        }
      `}</style>
    </div>
  );
}
