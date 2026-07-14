import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", zIndex: 1 }}>
      <div style={{ width: "100%", maxWidth: 400, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: "40px 36px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: "oklch(0.72 0.2 300 / 0.15)", border: "1px solid oklch(0.72 0.2 300 / 0.3)", marginBottom: 16 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="oklch(0.72 0.2 300)" strokeWidth="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="oklch(0.72 0.2 300)" strokeWidth="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="oklch(0.72 0.2 300)" strokeWidth="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="oklch(0.72 0.2 300)" strokeWidth="1.5" />
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)" }}>Aurora Content Line</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Sign in with your Aurora account</p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(["Email", "Password"] as const).map((label) => (
            <div key={label}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>{label}</label>
              <input
                type={label === "Password" ? "password" : "email"}
                value={label === "Email" ? email : password}
                onChange={(e) => label === "Email" ? setEmail(e.target.value) : setPassword(e.target.value)}
                required
                placeholder={label === "Email" ? "you@example.com" : "••••••••"}
                style={{ width: "100%", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontSize: 14, outline: "none" }}
              />
            </div>
          ))}
          <button type="submit" disabled={loading} style={{ marginTop: 8, width: "100%", padding: 12, borderRadius: 12, background: "var(--accent)", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")} style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
