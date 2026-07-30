import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Palette, Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

export function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  const BASE = import.meta.env.BASE_URL;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "24px", position: "relative", overflow: "hidden" }}>
      {/* Cover images — decorative background */}
      <img
        src={`${BASE}cover-studios.png`}
        alt=""
        aria-hidden
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.08, pointerEvents: "none", userSelect: "none" }}
      />
      <img
        src={`${BASE}cover-artist.png`}
        alt=""
        aria-hidden
        style={{ position: "absolute", right: 0, top: 0, height: "100%", width: "auto", objectFit: "cover", opacity: 0.12, pointerEvents: "none", userSelect: "none" }}
      />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, var(--bg) 30%, transparent 100%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, var(--accent), oklch(0.6 0.22 280))", marginBottom: 16, boxShadow: "0 0 32px var(--accent-glow)" }}>
            <Palette size={26} color="white" />
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)" }}>Colors Studio</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-muted)" }}>Cinematic photoshoots in any color palette</p>
        </div>

        {/* Card */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, padding: 32 }}>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>Email</span>
              <div style={{ position: "relative" }}>
                <Mail size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={{ width: "100%", padding: "11px 12px 11px 36px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
              </div>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)" }}>Password</span>
              <div style={{ position: "relative" }}>
                <Lock size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: "100%", padding: "11px 40px 11px 36px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <button type="submit" disabled={loading} style={{ marginTop: 4, padding: "13px", background: "var(--accent)", border: "none", borderRadius: 10, color: "white", fontWeight: 700, fontSize: 15, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 0 24px var(--accent-glow)" }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Sign in
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: 18, marginBottom: 0, fontSize: 13, color: "var(--text-muted)" }}>Sign in with your Aurora account.</p>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
          Part of the <a href="/" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Aurora</a> ecosystem
        </p>
      </div>
    </div>
  );
}
