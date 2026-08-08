/**
 * /eromify — Adult School studio landing (admin-accessible).
 * Full Eromify-brand design: dark pink, eyebrow/display type, ChatWindow UI.
 * Links into the aurora-adult artifact at /aurora-adult/.
 */
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Lock, EyeOff, ShieldCheck } from "lucide-react";

export const Route = createLazyFileRoute("/eromify")({ component: EromifyPage });

const ADULT_URL = "/aurora-adult/";

const AVATARS = [
  { name: "Yuki",  niche: "Fashion · Editorial", img: "/sample-photos/model-yuki-1.jpg" },
  { name: "Lily",  niche: "Travel · Outdoor",    img: "/eromify/avatar-lily.jpg" },
  { name: "Aria",  niche: "Lifestyle",            img: "/eromify/avatar-aria.jpg" },
  { name: "Maya",  niche: "Beauty · Glam",        img: "/eromify/avatar-maya.jpg" },
];

const GRID = Array.from({ length: 8 }, (_, i) => `/eromify/grid-${i + 1}.jpg`);

const LOOKS = [
  { id: "boudoir",   label: "Boudoir",      swatch: "from-rose-700 to-rose-950" },
  { id: "velvet",    label: "Velvet",        swatch: "from-violet-700 to-violet-950" },
  { id: "golden",    label: "Golden Hour",   swatch: "from-amber-600 to-amber-950" },
  { id: "neon",      label: "Neon",          swatch: "from-fuchsia-600 to-pink-950" },
  { id: "luxury",    label: "Luxury Suite",  swatch: "from-stone-600 to-stone-950" },
  { id: "noir",      label: "Noir",          swatch: "from-gray-600 to-gray-950" },
  { id: "ethereal",  label: "Ethereal",      swatch: "from-purple-600 to-indigo-950" },
  { id: "power",     label: "Power",         swatch: "from-red-600 to-red-950" },
];

const SHIP_CARDS = [
  {
    tag: "Quick shot",
    title: "One look, 60 seconds",
    body: "Upload a face photo, pick an editorial look, hit Generate. Aurora locks your identity across every render.",
    prompt: "Boudoir editorial, silk sheets, warm amber window light, 85mm, 8K ultra-HD.",
  },
  {
    tag: "Full campaign",
    title: "8 looks in a single session",
    body: "Run through every editorial style in one sitting. Download, watermark, distribute — all from your private vault.",
    prompt: "Generate all 8 looks of Yuki — boudoir through power editorial, 9:16 portrait, 8K.",
  },
  {
    tag: "Privacy first",
    title: "Yours, forever private",
    body: "Zero public indexing. Zero third-party sharing. Every frame stays in your private vault until you choose to export.",
    prompt: "Every shot lives in your admin vault. Your face, your content, your control.",
  },
];

const SECURITY_STATS = [
  ["8", "Editorial looks"],
  ["8K", "Ultra-HD output"],
  ["~60s", "Render time"],
  ["100%", "Private vault"],
];

const SECURITY_CARDS = [
  ["Private by default", "Every image is generated and stored in a private vault. Zero public indexing, zero third-party sharing. Your content is never visible to anyone but you."],
  ["Watermark built-in", "Each frame carries an embedded watermark automatically — brand every piece before it leaves your hands."],
  ["Identity lock", "Face ID technology preserves your exact facial likeness, skin tone, and hairstyle across every look. No drift, no CGI smoothing."],
  ["Operator-only access", "Secured behind a passcode. No public sign-up. Access is controlled and audited — only operators can enter the studio."],
];

const FAQS = [
  ["How does identity locking work?", "You upload 1–2 face reference photos. Aurora passes them as strict identity anchors to the image model alongside an 8K editorial prompt. The model preserves your exact facial features, skin tone, and hairstyle across every look."],
  ["Are my photos stored anywhere?", "Reference photos are sent to the generation endpoint and used only for that render. They are not stored in any public database or used for training."],
  ["How long does a shot take?", "Most shots complete in 45–90 seconds depending on the selected model and server load."],
  ["Can I use my own prompt on top of a look?", "Yes. Each look has a built-in editorial prompt that locks quality. You can add outfit details, setting notes, or styling instructions in the 'Extra details' field."],
  ["What's the credit cost?", "Each generation costs 1 Aura credit. Credits are shared with your main Aurora account."],
];

// ── Inline design tokens ──────────────────────────────────────────────────────
const C = {
  bg:        "#06020a",
  card:      "#0d080f",
  border:    "rgba(255,255,255,0.07)",
  muted:     "rgba(255,255,255,0.38)",
  pink:      "#e11d6a",
  pinkSoft:  "#f472b6",
  pinkGrad:  "linear-gradient(100deg,#e11d6a,#f472b6)",
} as const;

// ── Re-usable tiny components ──────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: C.pink }}>
      {children}
    </p>
  );
}

function Display({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <h2 style={{ fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.02, textTransform: "uppercase", color: "white", ...style }}
      className={className}>
      {children}
    </h2>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16 }} className={className}>
      {children}
    </div>
  );
}

function ChatWindow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflow: "hidden", borderRadius: 18, border: `1px solid ${C.border}`, background: C.card, boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderBottom: `1px solid ${C.border}`, padding: "12px 16px" }}>
        {[0,1,2].map(i => <span key={i} style={{ height: 12, width: 12, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />)}
        <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: "0.7rem", letterSpacing: "0.2em", color: C.muted }}>
          ADULT SCHOOL · EROMIFY
        </span>
      </div>
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>{children}</div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginLeft: "auto", maxWidth: "85%", borderRadius: "16px 4px 16px 16px", border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.06)", padding: "12px 16px", fontSize: 14, color: "white" }}>
      {children}
    </div>
  );
}

function AssistantRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ marginTop: 2, flexShrink: 0, height: 36, width: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: C.pinkGrad, color: "white" }}>
        <Sparkles size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12, paddingTop: 4 }}>{children}</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function EromifyPage() {
  const navigate = useNavigate();
  function enter() { window.open(ADULT_URL, "_blank"); }

  return (
    <div id="top" style={{ background: C.bg, minHeight: "100vh", color: "white", fontFamily: "Inter, system-ui, sans-serif", WebkitFontSmoothing: "antialiased", overflowX: "hidden" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header style={{ position: "fixed", inset: "0 0 auto 0", zIndex: 50, borderBottom: `1px solid ${C.border}`, backdropFilter: "blur(20px)", background: "rgba(6,2,10,0.88)" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: C.pinkGrad, fontSize: 16, fontWeight: 900, fontStyle: "italic", color: "white" }}>e</span>
            <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.02em" }}>Eromify</span>
            <span style={{ borderRadius: 6, padding: "2px 6px", fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", background: "rgba(225,29,106,0.12)", color: C.pink }}>Adult School</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => navigate({ to: "/" })}
              style={{ fontSize: 13, fontWeight: 500, color: C.muted, background: "none", border: "none", cursor: "pointer", transition: "color 0.15s" }}>
              Back to Aurora
            </button>
            <button onClick={enter}
              style={{ display: "flex", alignItems: "center", gap: 8, borderRadius: 999, background: C.pinkGrad, padding: "8px 20px", fontSize: 13, fontWeight: 600, color: "white", border: "none", cursor: "pointer", boxShadow: `0 0 30px -8px ${C.pink}` }}>
              Enter studio <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </header>

      <main style={{ paddingTop: 64 }}>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section style={{ position: "relative", overflow: "hidden" }}>
          <div aria-hidden style={{ pointerEvents: "none", position: "absolute", left: "50%", top: 0, height: 520, width: 820, transform: "translateX(-50%)", borderRadius: "50%", opacity: 0.35, filter: "blur(120px)", background: `radial-gradient(circle,${C.pink},transparent 70%)` }} />
          <div style={{ position: "relative", maxWidth: 1152, margin: "0 auto", padding: "80px 20px 112px" }}>
            <div style={{ maxWidth: 768, margin: "0 auto", textAlign: "center" }}>
              <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: C.pink }}>
                AI Photoshoot Studio · 18+
              </p>
              <h1 style={{ fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.02, textTransform: "uppercase", fontSize: "clamp(2.5rem,8vw,4.5rem)", marginTop: 20, color: "white" }}>
                Your editorial.<br />
                Your{" "}
                <span style={{ background: `linear-gradient(100deg,${C.pink},${C.pinkSoft})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                  identity.
                </span><br />
                Your control.
              </h1>
              <p style={{ maxWidth: 480, margin: "24px auto 0", fontSize: 17, lineHeight: 1.65, color: C.muted }}>
                Upload a face photo. Choose from 8 cinema-grade editorial looks. Get an 8K ultra-HD shot in ~60 seconds — private, watermarked, yours.
              </p>
            </div>

            {/* 3-step */}
            <div style={{ maxWidth: 960, margin: "56px auto 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
              {[
                { n: 1, title: "Upload face photo", body: "Drop in 1–2 reference photos. Aurora uses them as strict identity anchors — your exact look, locked every time." },
                { n: 2, title: "Choose a look", body: "Pick from 8 cinema-grade editorial styles: Boudoir → Noir → Ethereal → Power. Each is tuned for identity preservation." },
                { n: 3, title: "Generate & download", body: "Hit Generate. Your 8K shot renders in ~60 seconds and lands in your private vault — watermarked, never indexed." },
              ].map(({ n, title, body }) => (
                <Card key={n} className="p-6">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ display: "flex", height: 32, width: 32, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "rgba(225,29,106,0.15)", fontSize: 14, fontWeight: 700, color: C.pink }}>{n}</span>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "white" }}>{title}</h3>
                  </div>
                  <p style={{ marginTop: 16, fontSize: 13, lineHeight: 1.7, color: C.muted }}>{body}</p>
                </Card>
              ))}
            </div>

            <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <button onClick={enter}
                style={{ borderRadius: 999, background: C.pinkGrad, padding: "12px 28px", fontSize: 14, fontWeight: 600, color: "white", border: "none", cursor: "pointer", boxShadow: `0 0 40px -8px ${C.pink}` }}>
                Enter the studio
              </button>
              <span style={{ fontSize: 12, color: C.muted }}>🔒 Private vault · 🛡 Watermarked · 🎭 Face ID lock</span>
            </div>
          </div>
        </section>

        {/* ── Studio intro ──────────────────────────────────────────────── */}
        <section style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: "rgba(13,8,15,0.6)", padding: "80px 20px" }}>
          <div style={{ maxWidth: 1152, margin: "0 auto", textAlign: "center" }}>
            <Eyebrow>A complete editorial studio</Eyebrow>
            <Display className="text-4xl sm:text-5xl mt-3" style={{ fontSize: "clamp(2rem,6vw,3.5rem)" } as React.CSSProperties}>
              8 looks. One identity lock.
            </Display>
            <p style={{ maxWidth: 480, margin: "20px auto 0", fontSize: 17, color: C.muted }}>
              Boudoir through power editorial. ARRI cinema grade. 8K ultra-HD. Ready in a minute.
            </p>
          </div>
        </section>

        {/* ── Avatar section ────────────────────────────────────────────── */}
        <section style={{ maxWidth: 1152, margin: "0 auto", padding: "96px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 56, alignItems: "center" }}>
            <div>
              <Eyebrow>Preset models</Eyebrow>
              <Display style={{ fontSize: "clamp(2rem,5vw,3rem)", marginTop: 12 }}>Use a model by name</Display>
              <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.65, color: C.muted, maxWidth: 480 }}>
                Aurora keeps a curated gallery of identity-locked models ready to shoot. Select one in the studio and generate editorial shots without uploading anything.
              </p>
            </div>
            <ChatWindow>
              <UserBubble>Show me available preset models</UserBubble>
              <AssistantRow>
                <p style={{ fontSize: 14, color: C.muted }}>4 preset models available:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {AVATARS.map((a) => (
                    <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", padding: "8px 12px" }}>
                      <img src={a.img} alt={a.name} loading="lazy" style={{ height: 36, width: 36, borderRadius: "50%", objectFit: "cover", objectPosition: "top" }} />
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 500, color: "white" }}>{a.name}</p>
                        <p style={{ fontSize: 12, color: C.muted }}>{a.niche}</p>
                      </div>
                      <span style={{ marginLeft: "auto", fontFamily: "monospace", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", color: "#4ade80" }}>READY</span>
                    </div>
                  ))}
                </div>
              </AssistantRow>
            </ChatWindow>
          </div>
        </section>

        {/* ── Bulk generation ───────────────────────────────────────────── */}
        <section style={{ borderTop: `1px solid ${C.border}`, background: "rgba(13,8,15,0.5)", padding: "96px 20px" }}>
          <div style={{ maxWidth: 1152, margin: "0 auto" }}>
            <div style={{ maxWidth: 640 }}>
              <Eyebrow>Bulk generation</Eyebrow>
              <Display style={{ fontSize: "clamp(2rem,5vw,3rem)", marginTop: 12 }}>8 looks. One session.</Display>
              <p style={{ marginTop: 20, fontSize: 17, lineHeight: 1.65, color: C.muted }}>
                Run through every editorial look in a single session. Same identity lock across all 8. Each shot at 8K ultra-HD and landing directly in your private vault.
              </p>
            </div>
            <div style={{ marginTop: 48 }}>
              <ChatWindow>
                <UserBubble>Generate all 8 editorial looks of Yuki — 9:16 portrait, 8K ultra-HD</UserBubble>
                <AssistantRow>
                  <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: C.muted }}>
                    <span style={{ display: "inline-block", height: 8, width: 8, borderRadius: "50%", background: C.pink, animation: "pulse-dot 1.4s ease-in-out infinite" }} />
                    Rendering 8 editorial looks…
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                    {GRID.map((src, i) => (
                      <img key={i} src={src} alt={`Look ${i + 1}`} loading="lazy"
                        style={{ width: "100%", aspectRatio: "4/5", objectFit: "cover", borderRadius: 8 }} />
                    ))}
                  </div>
                  <p style={{ fontFamily: "monospace", fontSize: 12, color: "#4ade80" }}>✓ Done · 8 credits used · Saved to your vault</p>
                </AssistantRow>
              </ChatWindow>
            </div>
          </div>
        </section>

        {/* ── What you can ship ─────────────────────────────────────────── */}
        <section style={{ maxWidth: 1152, margin: "0 auto", padding: "96px 20px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
            <Eyebrow>What you can create</Eyebrow>
            <Display style={{ fontSize: "clamp(2rem,5vw,3rem)", marginTop: 12 }}>From upload to campaign in minutes</Display>
          </div>
          <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20 }}>
            {SHIP_CARDS.map((c) => (
              <Card key={c.tag} className="flex flex-col p-6">
                <p style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: C.pink }}>{c.tag}</p>
                <h3 style={{ fontSize: 17, fontWeight: 600, color: "white", marginTop: 16 }}>{c.title}</h3>
                <p style={{ flex: 1, fontSize: 13, lineHeight: 1.7, color: C.muted, marginTop: 12 }}>{c.body}</p>
                <p style={{ marginTop: 20, borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)", padding: "8px 12px", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, color: C.pinkSoft }}>
                  {c.prompt}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Security stats ────────────────────────────────────────────── */}
        <section style={{ borderTop: `1px solid ${C.border}`, background: "rgba(13,8,15,0.5)", padding: "96px 20px" }}>
          <div style={{ maxWidth: 1152, margin: "0 auto" }}>
            <div style={{ maxWidth: 640 }}>
              <Eyebrow>Privacy & security</Eyebrow>
              <Display style={{ fontSize: "clamp(2rem,5vw,3rem)", marginTop: 12 }}>Built for total privacy</Display>
              <p style={{ marginTop: 20, fontSize: 17, color: C.muted }}>
                Every technical decision was made to protect your identity and content.
              </p>
            </div>
            <div style={{ marginTop: 48, display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
              {SECURITY_STATS.map(([n, l]) => (
                <Card key={l} className="p-6 text-center">
                  <p style={{ fontSize: "2.5rem", fontWeight: 900, background: `linear-gradient(100deg,${C.pink},${C.pinkSoft})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{n}</p>
                  <p style={{ marginTop: 8, fontFamily: "monospace", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.15em", color: C.muted }}>{l}</p>
                </Card>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
              {SECURITY_CARDS.map(([title, body]) => (
                <Card key={title} className="p-6">
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "white" }}>{title}</h3>
                  <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7, color: C.muted }}>{body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── Editorial looks grid ──────────────────────────────────────── */}
        <section style={{ maxWidth: 1152, margin: "0 auto", padding: "96px 20px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto 40px", textAlign: "center" }}>
            <Eyebrow>8 editorial looks</Eyebrow>
            <Display style={{ fontSize: "clamp(2rem,5vw,3rem)", marginTop: 12 }}>Every mood. Every scene.</Display>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 12 }}>
            {LOOKS.map(l => (
              <div key={l.id} style={{ position: "relative", overflow: "hidden", borderRadius: 16, border: `1px solid ${C.border}` }}>
                <div className={`h-[160px] bg-gradient-to-b ${l.swatch} opacity-90`} />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top,rgba(0,0,0,0.8),transparent)", padding: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "white" }}>{l.label}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <section style={{ maxWidth: 896, margin: "0 auto", padding: "96px 20px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto 48px", textAlign: "center" }}>
            <Eyebrow>FAQ</Eyebrow>
            <Display style={{ fontSize: "clamp(2rem,5vw,3rem)", marginTop: 12 }}>Common questions</Display>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQS.map(([q, a]) => (
              <details key={q} style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, padding: "20px 24px" }}>
                <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, fontSize: 15, fontWeight: 600, color: "white", cursor: "pointer", listStyle: "none" }}>
                  {q}
                  <span style={{ color: C.pink, transition: "transform 0.2s" }}>+</span>
                </summary>
                <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.7, color: C.muted }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────── */}
        <section style={{ position: "relative", overflow: "hidden", borderTop: `1px solid ${C.border}`, padding: "112px 20px" }}>
          <div aria-hidden style={{ pointerEvents: "none", position: "absolute", left: "50%", top: "50%", height: 400, width: 700, transform: "translate(-50%,-50%)", borderRadius: "50%", opacity: 0.25, filter: "blur(120px)", background: `radial-gradient(circle,${C.pink},transparent 70%)` }} />
          <div style={{ position: "relative", maxWidth: 768, margin: "0 auto", textAlign: "center" }}>
            <Eyebrow>Ready when you are</Eyebrow>
            <Display style={{ fontSize: "clamp(2rem,6vw,3.75rem)", marginTop: 12 }}>Your studio just leveled up</Display>
            <p style={{ maxWidth: 480, margin: "20px auto 0", fontSize: 17, color: C.muted }}>
              Operator-only. Private. Secured. 8K ultra-HD in ~60 seconds.
            </p>
            <div style={{ marginTop: 36, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <button onClick={enter}
                style={{ borderRadius: 999, background: C.pinkGrad, padding: "12px 28px", fontSize: 14, fontWeight: 600, color: "white", border: "none", cursor: "pointer", boxShadow: `0 0 40px -8px ${C.pink}` }}>
                Enter the studio
              </button>
              <span style={{ fontSize: 12, color: C.muted }}>🔞 18+ · Operator-only · 1 Aura per shot</span>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, background: "rgba(13,8,15,0.7)", padding: "40px 20px" }}>
        <div style={{ maxWidth: 1152, margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 12, color: C.muted }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "flex", height: 24, width: 24, alignItems: "center", justifyContent: "center", borderRadius: "50%", background: C.pinkGrad, fontSize: 12, fontWeight: 900, fontStyle: "italic", color: "white" }}>e</span>
            <span style={{ fontWeight: 700, color: "white" }}>Eromify · Adult School</span>
          </div>
          <p>🔞 18+ operator-only · Private vault · Powered by Aurora AI</p>
          <div style={{ display: "flex", gap: 20 }}>
            <a href="#" style={{ color: C.muted, textDecoration: "none" }}>Terms</a>
            <a href="#" style={{ color: C.muted, textDecoration: "none" }}>Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
