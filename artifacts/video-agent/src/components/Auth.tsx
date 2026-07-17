import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const SB = "https://tpzmvbczwahxajujvnrq.supabase.co/storage/v1/object/public/studio/showcase";
const LOOPING = `${SB}/nba-josh-looping.png`;
const REF     = `${SB}/nba-josh-ref.jpg`;

// PuLID-generated multi-angle shots (identity-locked via fal.ai / uploaded to CDN)
const ANGLES = [
  { src: `${SB}/gen-stage.jpg`,  label: "Wireless Festival",   sub: "Bird's eye · identity locked" },
  { src: `${SB}/gen-street.jpg`, label: "Looping Officers",    sub: "Dutch angle · golden hour" },
  { src: `${SB}/gen-studio.jpg`, label: "Recording Session",   sub: "Studio portrait · neon" },
  { src: `${SB}/gen-benz.jpg`,   label: "Benz Scene",          sub: "Night city interior" },
];

const CHIPS = [
  { icon: "🎬", label: "HeyGen Avatar Video" },
  { icon: "✍️", label: "AI Script Writer" },
  { icon: "🧠", label: "Remembers Your Style" },
  { icon: "🎭", label: "Multi-angle Reshoot" },
];

export function Auth() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [mode, setMode]         = useState<"login" | "signup">("login");

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

      {/* ── LEFT: sign-in panel ─────────────────────────────────── */}
      <div style={{
        flex: "0 0 420px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 36px",
        background: "var(--bg)",
        position: "relative",
        zIndex: 1,
      }}>
        <div style={{ width: "100%", maxWidth: 340 }}>

          {/* Logo */}
          <div style={{ marginBottom: 24 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 44, height: 44, borderRadius: 12,
              background: "oklch(0.72 0.2 300 / 0.15)",
              border: "1px solid oklch(0.72 0.2 300 / 0.3)",
              marginBottom: 14,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"
                  stroke="oklch(0.72 0.2 300)" strokeWidth="1.5"
                  strokeLinejoin="round" fill="oklch(0.72 0.2 300 / 0.2)" />
              </svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em", marginBottom: 4 }}>
              Aurora <span style={{ color: "var(--accent)" }}>Video Agent</span>
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Your AI creative studio with persistent memory — it learns your style, remembers every project.
            </p>
          </div>

          {/* Feature chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
            {CHIPS.map(f => (
              <span key={f.label} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "4px 10px", borderRadius: 20,
                background: "oklch(0.72 0.2 300 / 0.08)",
                border: "1px solid oklch(0.72 0.2 300 / 0.2)",
                fontSize: 11, fontWeight: 500, color: "var(--text-muted)",
              }}>
                {f.icon} {f.label}
              </span>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ display: "flex", gap: 0, background: "var(--bg-input)", borderRadius: 10, padding: 3, marginBottom: 2 }}>
              {(["login", "signup"] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} style={{
                  flex: 1, padding: "7px 0", borderRadius: 8, border: "none",
                  background: mode === m ? "var(--bg-card)" : "transparent",
                  color: mode === m ? "var(--text)" : "var(--text-muted)",
                  fontWeight: mode === m ? 600 : 400, fontSize: 13,
                  cursor: "pointer", transition: "all 0.15s",
                  boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.2)" : "none",
                }}>
                  {m === "login" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            {(["email", "password"] as const).map(field => (
              <div key={field}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", display: "block", marginBottom: 5 }}>
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <input
                  type={field}
                  value={field === "email" ? email : password}
                  onChange={e => field === "email" ? setEmail(e.target.value) : setPassword(e.target.value)}
                  required
                  placeholder={field === "email" ? "you@example.com" : "••••••••"}
                  style={{
                    width: "100%", background: "var(--bg-input)",
                    border: "1px solid var(--border)", borderRadius: 10,
                    padding: "11px 14px", color: "var(--text)", fontSize: 14,
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            ))}

            <button type="submit" disabled={loading} style={{
              marginTop: 2, width: "100%", padding: "12px", borderRadius: 12,
              background: "var(--accent)", color: "#fff", fontWeight: 600,
              fontSize: 14, border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1, transition: "opacity 0.15s",
            }}>
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: 18, fontSize: 13, color: "var(--text-muted)" }}>
            {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")}
              style={{ color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>

      {/* ── RIGHT: NBA Josh showcase mosaic ─────────────────────── */}
      <div style={{
        flex: 1,
        display: "flex",
        overflow: "hidden",
        background: "oklch(0.05 0.015 272)",
        gap: 3,
      }}>

        {/* LEFT col of mosaic: Looping Officers hero (full height) */}
        <div style={{ flex: "0 0 55%", position: "relative", overflow: "hidden" }}>
          <img
            src={LOOPING}
            alt="NBA Josh · Looping Officers"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 15%", display: "block" }}
          />

          {/* Gradient */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)",
            pointerEvents: "none",
          }} />

          {/* Character chip */}
          <div style={{
            position: "absolute", top: 16, left: 16,
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 12px", borderRadius: 12,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            <img src={REF} alt="NBA Josh" style={{
              width: 32, height: 32, borderRadius: 6,
              objectFit: "cover", objectPosition: "center top",
              border: "1px solid oklch(0.72 0.2 300 / 0.5)",
            }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>NBA Josh</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>OutTheMud Records</div>
            </div>
          </div>

          {/* Bottom caption */}
          <div style={{ position: "absolute", bottom: 16, left: 16, right: 16 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 8px", borderRadius: 20, marginBottom: 6,
              background: "oklch(0.72 0.2 300 / 0.25)",
              border: "1px solid oklch(0.72 0.2 300 / 0.45)",
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "oklch(0.72 0.2 300)", display: "inline-block" }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: "oklch(0.72 0.2 300)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Aurora · Kling v3
              </span>
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)", margin: 0, lineHeight: 1.3 }}>
              Looping Officers
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: "2px 0 0" }}>
              AI music video still · identity-locked
            </p>
          </div>
        </div>

        {/* RIGHT col: 2×2 PuLID angle grid */}
        <div style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 3,
        }}>
          {ANGLES.map((a, i) => (
            <div key={i} style={{ position: "relative", overflow: "hidden" }}>
              <img
                src={a.src}
                alt={a.label}
                style={{
                  width: "100%", height: "100%",
                  objectFit: "cover", objectPosition: "center top",
                  display: "block",
                }}
              />
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)",
                pointerEvents: "none",
              }} />
              <div style={{ position: "absolute", bottom: 8, left: 9, right: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{a.label}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", marginTop: 1 }}>{a.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
