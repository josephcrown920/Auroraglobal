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
    <div style={{ minHeight: "100vh", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>

      {/* Full-bleed cinematic background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: "url('/video-agent/demo-cinematic.webp')",
        backgroundSize: "cover", backgroundPosition: "center 20%",
        filter: "blur(2px) brightness(0.55) saturate(1.3)",
        transform: "scale(1.04)",
      }} />

      {/* Violet ambient gradient over image */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 1,
        background: "linear-gradient(135deg, oklch(0.18 0.06 300 / 0.6) 0%, oklch(0.08 0.03 272 / 0.5) 60%, transparent 100%)",
      }} />

      {/* Variation grid strip — decorative top badge */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 100, zIndex: 1, overflow: "hidden",
        backgroundImage: "url('/video-agent/demo-variations.jpg')",
        backgroundSize: "cover", backgroundPosition: "center top",
        filter: "blur(0px) brightness(0.35)",
        maskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 100%)",
      }} />

      {/* Glass sign-in card */}
      <div style={{
        position: "relative", zIndex: 2, width: "100%", maxWidth: 420,
        background: "rgba(9, 9, 18, 0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 28,
        padding: "42px 38px",
        boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(147,104,245,0.08) inset, 0 1px 0 rgba(255,255,255,0.1) inset",
      }}>

        {/* Top accent line */}
        <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg, transparent, oklch(0.72 0.2 300 / 0.5), transparent)", borderRadius: 1 }} />

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 60, height: 60, borderRadius: 18, marginBottom: 18,
            background: "rgba(147,104,245,0.12)",
            border: "1px solid rgba(147,104,245,0.25)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 0 32px rgba(147,104,245,0.2)",
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="7" width="15" height="11" rx="2.5" stroke="oklch(0.72 0.2 300)" strokeWidth="1.7"/>
              <path d="M17 10l5-3v10l-5-3V10Z" stroke="oklch(0.72 0.2 300)" strokeWidth="1.7" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 7 }}>
            Aurora <span style={{ color: "oklch(0.72 0.2 300)" }}>Video Agent</span>
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
            Cinematic AI video from your script — powered by HeyGen
          </p>
        </div>

        {/* Demo variation strip inside card */}
        <div style={{
          borderRadius: 14, overflow: "hidden", marginBottom: 28, height: 80, position: "relative",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <img src="/video-agent/demo-variations.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 35%", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(9,9,18,0.7) 0%, transparent 30%, transparent 70%, rgba(9,9,18,0.7) 100%)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.08em", textTransform: "uppercase", backdropFilter: "blur(4px)", padding: "4px 12px", borderRadius: 20, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>
              Sports · Fashion · Music · Beauty · Lifestyle
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "Email", type: "email", value: email, set: setEmail, placeholder: "you@example.com" },
            { label: "Password", type: "password", value: password, set: setPassword, placeholder: "••••••••" },
          ].map(({ label, type, value, set, placeholder }) => (
            <div key={label}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 7, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {label}
              </label>
              <input
                type={type}
                value={value}
                onChange={(e) => set(e.target.value)}
                required
                placeholder={placeholder}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.06)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: "11px 15px",
                  color: "#fff", fontSize: 14, outline: "none",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onFocus={(e) => { e.target.style.borderColor = "oklch(0.72 0.2 300 / 0.6)"; e.target.style.background = "rgba(147,104,245,0.08)"; }}
                onBlur={(e)  => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.background = "rgba(255,255,255,0.06)"; }}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6, width: "100%", padding: "13px",
              borderRadius: 14, fontWeight: 700, fontSize: 14,
              background: "linear-gradient(135deg, oklch(0.72 0.2 300) 0%, oklch(0.62 0.22 290) 100%)",
              color: "#fff", border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: loading ? "none" : "0 0 28px oklch(0.72 0.2 300 / 0.45), 0 4px 12px rgba(0,0,0,0.3)",
              transition: "all 0.2s",
              letterSpacing: "-0.01em",
            }}
          >
            {loading ? "Please wait…" : mode === "login" ? "Sign in →" : "Create account →"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            style={{ color: "oklch(0.72 0.2 300)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
