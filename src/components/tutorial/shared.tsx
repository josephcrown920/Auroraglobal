import type * as React from "react";
import { C } from "./tokens";

// ─── Shared sub-components ────────────────────────────────────────────────────

export function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: `linear-gradient(135deg, ${C.accent}, oklch(0.6 0.22 280))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, color: "#fff", flexShrink: 0,
      }}>✦</div>
      <span style={{ fontWeight: 800, fontSize: 16, color: C.text, letterSpacing: "-0.02em" }}>
        Aurora Studio
      </span>
    </div>
  );
}

export function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      marginBottom: 28, paddingBottom: 20,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <Logo />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.textMuted }}>Section {num}</span>
        <span style={{ fontWeight: 800, fontSize: 22, color: C.accent, letterSpacing: "-0.02em" }}>
          {title}
        </span>
      </div>
    </div>
  );
}

export function ConceptBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${C.accent}`,
      borderRadius: "0 10px 10px 0", padding: "16px 20px", marginBottom: 20,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: C.accent, marginBottom: 8 }}>
        ⚡ The Concept
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.65, color: C.text }}>{children}</div>
    </div>
  );
}

export function NeedBox({ items }: { items: string[] }) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "16px 20px", marginBottom: 24,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: C.accent, marginBottom: 12 }}>
        ⚡ What You Need
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10,
            fontSize: 14, lineHeight: 1.6, color: C.text, marginBottom: 6 }}>
            <span style={{ color: C.accent, flexShrink: 0, marginTop: 1 }}>✦</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Step({ num, title, children }: { num: number; title: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg, ${C.accent}, oklch(0.6 0.22 280))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 13, color: "#fff", marginTop: 2,
      }}>{num}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: children ? 8 : 0 }}>
          {title}
        </div>
        {children && <div style={{ fontSize: 13.5, lineHeight: 1.65, color: C.text }}>{children}</div>}
      </div>
    </div>
  );
}

export function PromptBlock({ label, prompt }: { label?: string; prompt: string }) {
  return (
    <div style={{
      background: C.bgElevated, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${C.accent}`, borderRadius: "0 8px 8px 0",
      margin: "12px 0 16px 0", overflow: "hidden",
    }}>
      {label && (
        <div style={{
          padding: "7px 16px", background: C.accentDim,
          borderBottom: `1px solid ${C.border}`,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: C.accent,
        }}>
          {label}
        </div>
      )}
      <div style={{
        padding: "14px 16px", fontSize: 12.5, lineHeight: 1.75,
        color: C.text, fontFamily: "'Courier New', monospace",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {prompt}
      </div>
    </div>
  );
}

export function TipBox({ children, variant = "tip" }: { children: React.ReactNode; variant?: "tip" | "warning" | "secret" }) {
  const icons: Record<string, string> = { tip: "💡", warning: "⚠️", secret: "🔒" };
  const labels: Record<string, string> = { tip: "Pro Tip", warning: "Important", secret: "The Secret" };
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "13px 16px", margin: "14px 0",
      fontSize: 13.5, lineHeight: 1.65, color: C.text,
    }}>
      <strong style={{ color: C.accent }}>{icons[variant]} {labels[variant]}: </strong>
      {children}
    </div>
  );
}

export function CustomizeTable({ rows }: { rows: { field: string; example: string; yours: string }[] }) {
  return (
    <table style={{
      width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 12,
    }}>
      <thead>
        <tr>
          {["Customize", "Example from guide", "Replace with yours"].map((h) => (
            <th key={h} style={{
              background: C.accentDim, color: C.accent, textAlign: "left",
              padding: "9px 12px", fontWeight: 700, fontSize: 11,
              letterSpacing: "0.08em", textTransform: "uppercase",
              border: `1px solid ${C.border}`,
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? C.bgCard : C.bgElevated }}>
            <td style={{ padding: "8px 12px", border: `1px solid ${C.border}`, fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap" }}>{row.field}</td>
            <td style={{ padding: "8px 12px", border: `1px solid ${C.border}`, color: C.text, fontFamily: "'Courier New', monospace", fontSize: 11.5 }}>{row.example}</td>
            <td style={{ padding: "8px 12px", border: `1px solid ${C.border}`, color: C.textMuted, fontStyle: "italic" }}>{row.yours}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FillTemplate({ label, template }: { label: string; template: string }) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 8, overflow: "hidden", margin: "14px 0",
    }}>
      <div style={{
        padding: "7px 14px", background: C.bgElevated,
        borderBottom: `1px solid ${C.border}`,
        fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color: C.textMuted,
      }}>
        {label}
      </div>
      <div style={{
        padding: "13px 14px", fontSize: 12, lineHeight: 1.75, color: C.text,
        fontFamily: "'Courier New', monospace", whiteSpace: "pre-wrap",
      }}>
        {template}
      </div>
    </div>
  );
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

export function CoverPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: C.bg, position: "relative", overflow: "hidden",
      padding: "60px 40px",
    }}>
      {/* Radial violet glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 70% 55% at 50% 42%, ${C.accentGlow}, transparent 65%)`,
      }} />

      <div style={{ position: "relative", textAlign: "center", maxWidth: 600 }}>
        {/* Logo mark */}
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          background: `linear-gradient(135deg, ${C.accent}, oklch(0.6 0.22 280))`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, margin: "0 auto 24px",
          boxShadow: `0 0 60px ${C.accentGlow}`,
        }}>✦</div>

        {/* Wordmark */}
        <h1 style={{
          margin: "0 0 10px", fontSize: 48, fontWeight: 800,
          letterSpacing: "-0.04em", color: C.text, lineHeight: 1,
        }}>
          Aurora Studio
        </h1>

        {/* Subtitle */}
        <p style={{
          margin: "0 0 48px", fontSize: 20, fontWeight: 400,
          color: C.textMuted, letterSpacing: "0.02em",
        }}>
          Artist Tutorial Guide
        </p>

        {/* Section pills */}
        <div style={{
          display: "flex", gap: 10, justifyContent: "center",
          flexWrap: "wrap", marginBottom: 60,
        }}>
          {[
            { n: "01", label: "Colors Performance" },
            { n: "02", label: "Motion Control" },
            { n: "03", label: "Phone Lip Sync" },
          ].map(({ n, label }) => (
            <div key={n} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: 100,
              border: `1px solid ${C.border}`,
              background: C.bgCard,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: "0.1em" }}>{n}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 40, height: 1, background: C.border, margin: "0 auto 24px" }} />

        {/* URL */}
        <p style={{
          margin: 0, fontSize: 13, color: C.textMuted,
          letterSpacing: "0.06em", textTransform: "lowercase",
        }}>
          aurora.studio
        </p>
      </div>
    </div>
  );
}
