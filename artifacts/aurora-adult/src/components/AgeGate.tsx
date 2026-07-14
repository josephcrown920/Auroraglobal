import { ShieldCheck, Lock, EyeOff } from "lucide-react";

interface Props { onConfirm: () => void; }

export function AgeGate({ onConfirm }: Props) {
  function confirm() {
    localStorage.setItem("aurora_adult_age_confirmed", "1");
    onConfirm();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "24px" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 100%, rgba(225,29,106,0.12) 0%, transparent 60%)" }} />

      <div style={{ width: "100%", maxWidth: 480, textAlign: "center", position: "relative" }} className="animate-fade-in">
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 80, height: 80, borderRadius: 24, background: "linear-gradient(135deg, #e11d6a, #7c0a3a)", marginBottom: 28, boxShadow: "0 0 60px rgba(225,29,106,0.5)" }}>
          <span style={{ fontSize: 36, lineHeight: 1 }}>🔞</span>
        </div>

        <h1 style={{ margin: "0 0 10px", fontSize: 34, fontWeight: 900, letterSpacing: "-0.03em", color: "var(--text)", lineHeight: 1.1 }}>
          You must be 18+<br />to enter this site
        </h1>
        <p style={{ margin: "0 0 36px", fontSize: 16, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Aurora for Creators is an adult platform for 18+ content creators.<br />
          By continuing you confirm you are of legal age.
        </p>

        {/* Trust badges */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 36, flexWrap: "wrap" }}>
          {[
            { icon: <Lock size={15} />, label: "Private vault" },
            { icon: <EyeOff size={15} />, label: "Identity masking" },
            { icon: <ShieldCheck size={15} />, label: "Watermark built-in" },
          ].map(({ icon, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
              <span style={{ color: "#e11d6a" }}>{icon}</span> {label}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={confirm} style={{ width: "100%", padding: "16px", background: "linear-gradient(135deg, #e11d6a, #9b1239)", border: "none", borderRadius: 14, color: "white", fontWeight: 800, fontSize: 17, cursor: "pointer", boxShadow: "0 0 40px rgba(225,29,106,0.45)", transition: "transform 0.15s, box-shadow 0.15s", letterSpacing: "-0.01em" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.02)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 56px rgba(225,29,106,0.6)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 40px rgba(225,29,106,0.45)"; }}>
            I am 18 or older — Enter
          </button>
          <button onClick={() => { window.location.href = "https://google.com"; }} style={{ width: "100%", padding: "13px", background: "transparent", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text-muted)", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
            I am under 18 — Exit
          </button>
        </div>

        <p style={{ marginTop: 24, fontSize: 12, color: "var(--text-muted)", opacity: 0.6, lineHeight: 1.5 }}>
          By entering you agree to our Terms of Service and confirm you are at least 18 years old.
          This choice is stored locally on your device.
        </p>
      </div>
    </div>
  );
}
