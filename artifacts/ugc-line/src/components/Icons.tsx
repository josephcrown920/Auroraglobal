// Brand + utility icons for the Content Line app.

export function ClaudeLogo({ size = 32 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: "linear-gradient(135deg, #d4a853 0%, #c4882f 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {/* Anthropic asterisk */}
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <line x1="12" y1="2" x2="12" y2="22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="2" y1="7" x2="22" y2="17" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="22" y1="7" x2="2" y2="17" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function AuroraLogo({ size = 32 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: "linear-gradient(135deg, oklch(0.72 0.2 300) 0%, oklch(0.55 0.22 290) 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L14.5 9.5H22L16 14L18.5 21.5L12 17L5.5 21.5L8 14L2 9.5H9.5L12 2Z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(255,255,255,0.15)" />
      </svg>
    </div>
  );
}

export function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
