import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const PREVIEW_PHOTOS = [
  "/video-agent/sample/p1.png",
  "/video-agent/sample/p4.jpeg",
  "/video-agent/sample/p2.png",
  "/video-agent/sample/p5.jpeg",
  "/video-agent/sample/p3.jpeg",
  "/video-agent/sample/p6.png",
  "/video-agent/sample/p7.png",
  "/video-agent/sample/p8.png",
];

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "stretch" }}>
      {/* Left — sign-in panel */}
      <div style={{
        flex: "0 0 440px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 40px",
        background: "var(--bg)",
        position: "relative",
        zIndex: 1,
      }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          {/* Logo */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "oklch(0.72 0.2 300 / 0.15)",
              border: "1px solid oklch(0.72 0.2 300 / 0.3)",
              marginBottom: 16,
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" stroke="oklch(0.72 0.2 300)" strokeWidth="1.5" strokeLinejoin="round" fill="oklch(0.72 0.2 300 / 0.2)" />
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: 4 }}>
              Aurora <span style={{ color: "var(--accent)" }}>Video Agent</span>
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Sign in with your Aurora account to start creating.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Mode toggle */}
            <div style={{ display: "flex", gap: 0, background: "var(--bg-input)", borderRadius: 10, padding: 3, marginBottom: 4 }}>
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1,
                    padding: "7px 0",
                    borderRadius: 8,
                    border: "none",
                    background: mode === m ? "var(--bg-card)" : "transparent",
                    color: mode === m ? "var(--text)" : "var(--text-muted)",
                    fontWeight: mode === m ? 600 : 400,
                    fontSize: 13,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
                  }}
                >
                  {m === "login" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: "100%",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: "var(--text)",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: "100%",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "11px 14px",
                  color: "var(--text)",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "12px",
                borderRadius: 12,
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 14,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
            {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>

      {/* Right — photo mosaic showcase */}
      <div style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        background: "oklch(0.06 0.02 272)",
      }}>
        {/* 2×4 photo grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "repeat(4, 1fr)",
          height: "100%",
          gap: 3,
        }}>
          {PREVIEW_PHOTOS.map((src, i) => (
            <div key={i} style={{ overflow: "hidden", position: "relative" }}>
              <img
                src={src}
                alt=""
                aria-hidden
                loading="eager"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center top",
                  display: "block",
                  transition: "transform 8s ease-in-out",
                }}
              />
            </div>
          ))}
        </div>

        {/* Dark gradient overlay at bottom */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, oklch(0.06 0.02 272 / 0.8) 0%, transparent 40%)",
          pointerEvents: "none",
        }} />

        {/* Caption */}
        <div style={{
          position: "absolute",
          bottom: 20,
          left: 0,
          right: 0,
          textAlign: "center",
        }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0 }}>
            AI-generated video variations · powered by HeyGen &amp; Aurora
          </p>
        </div>
      </div>
    </div>
  );
}
