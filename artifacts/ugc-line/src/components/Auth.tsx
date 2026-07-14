import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ClaudeLogo, AuroraLogo, ArrowRight } from "./Icons";

export function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) toast.error(error.message);
      else if (mode === "signup") toast.success("Check your email to confirm your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      {/* Gradient blobs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: 800, height: 500, borderRadius: "50%", background: "radial-gradient(ellipse, oklch(0.72 0.2 300 / 0.12) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "10%", right: "-10%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, oklch(0.72 0.2 300 / 0.06) 0%, transparent 70%)" }} />
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", zIndex: 1 }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          {/* Brand header */}
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 20 }}>
              <ClaudeLogo size={36} />
              <span style={{ fontSize: 22, color: "var(--border-strong)" }}>+</span>
              <AuroraLogo size={36} />
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", marginBottom: 8 }}>
              Content Line
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
              Claude MCP · UGC scripts · Visual variations
            </p>
          </div>

          {/* Demo preview strip */}
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 28, border: "1px solid var(--border)" }}>
            <img src="/ugc-line/demo-reference.jpg" alt="Demo" style={{ width: "100%", display: "block", maxHeight: 200, objectFit: "cover", objectPosition: "top" }} />
          </div>

          {/* Auth card */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "32px 28px" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "var(--text)" }}>
              {mode === "login" ? "Sign in to your workspace" : "Create an account"}
            </h2>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[{ label: "Email", type: "email", value: email, set: setEmail, placeholder: "you@example.com" },
                { label: "Password", type: "password", value: password, set: setPassword, placeholder: "••••••••" }].map(({ label, type, value, set, placeholder }) => (
                <div key={label}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={e => set(e.target.value)}
                    required
                    placeholder={placeholder}
                    style={{ width: "100%", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "11px 14px", color: "var(--text)", fontSize: 14, outline: "none", transition: "border-color 0.15s" }}
                    onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border)")}
                  />
                </div>
              ))}
              <button type="submit" disabled={loading} className="glow-btn" style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "13px 20px", borderRadius: 12, background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Please wait…" : <>{mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={15} /></>}
              </button>
            </form>
            <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "var(--text-muted)" }}>
              {mode === "login" ? "No account yet?" : "Already have one?"}{" "}
              <button onClick={() => setMode(mode === "login" ? "signup" : "login")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                {mode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
