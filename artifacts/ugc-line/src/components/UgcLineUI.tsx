import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Layers,
  FileText,
  ImageIcon,
  Download,
  Copy,
  Check,
  Loader2,
  Upload,
  X,
  LogOut,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { generateScripts, generateVariations, generateImages, type UgcBrief, type ImageResult } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface Props { session: Session; }

const ARC_COLOURS: Record<string, string> = {
  "pain-point":   "#ef444420",
  discovery:      "#f59e0b20",
  transformation: "#22c55e20",
  "social-proof": "#38bdf820",
  fomo:           "#d946ef20",
  cta:            "oklch(0.72 0.2 300 / 0.15)",
};
function arcBg(pos: string) {
  for (const [k, v] of Object.entries(ARC_COLOURS)) if (pos.toLowerCase().startsWith(k)) return v;
  return "oklch(1 0 0 / 0.05)";
}

const ALL_ANGLES = ["testimonial","before/after","myth-bust","unboxing","day-in-life","pov","comparison","tutorial","reaction"];
const NICHES = ["Wellness / health","Beauty / skincare","Fitness","Home / lifestyle","Tech / gadget","Fashion","Food / beverage","Finance / app","Pet care","Supplements"];
const LENGTHS = [{ value:"15s",label:"~15s" },{ value:"30s",label:"~30s" },{ value:"45s",label:"~45s" }] as const;

export function UgcLineUI({ session }: Props) {
  const token = session.access_token;
  const email = session.user.email ?? "";
  const [tab, setTab] = useState<"scripts"|"variations">("scripts");

  // ── Scripts state ─────────────────────────────────────────────────────────
  const [product, setProduct] = useState("e.g. Aura — magnesium sleep gummies, $28/mo");
  const [audience, setAudience] = useState("Women 25-40, into wellness / self-care");
  const [niche, setNiche] = useState("Wellness / health");
  const [angles, setAngles] = useState(new Set(["testimonial","before/after","myth-bust"]));
  const [length, setLength] = useState<"15s"|"30s"|"45s">("30s");
  const [count, setCount] = useState(6);
  const [briefs, setBriefs] = useState<(UgcBrief & { id: number })[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const counter = useRef(0);

  // ── Variations state ──────────────────────────────────────────────────────
  const [inputType, setInputType] = useState<"person"|"product">("person");
  const [refFile, setRefFile] = useState<File|null>(null);
  const [refPreview, setRefPreview] = useState<string|null>(null);
  const [direction, setDirection] = useState("casual streetwear, neutral tones, everyday looks");
  const [productName, setProductName] = useState("");
  const [varCount, setVarCount] = useState(6);
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [consent, setConsent] = useState(false);
  const [varResults, setVarResults] = useState<ImageResult[]>([]);
  const [varLoading, setVarLoading] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleGenerateScripts() {
    if (!product.trim()) { toast.error("Enter a product"); return; }
    if (angles.size === 0) { toast.error("Pick at least one hook angle"); return; }
    setScriptsLoading(true);
    try {
      const { briefs: newBriefs } = await generateScripts({ product, audience, niche, angles: [...angles], length, count }, token);
      setBriefs(prev => [...prev, ...newBriefs.map(b => ({ ...b, id: ++counter.current }))]);
      toast.success(`${newBriefs.length} briefs added`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setScriptsLoading(false); }
  }

  async function handleGenerateVariations() {
    if (!refFile) { toast.error("Upload a reference photo first"); return; }
    if (inputType === "person" && !consent) { toast.error("Confirm consent to use this photo"); return; }
    setVarLoading(true);
    try {
      const base64 = await fileToBase64(refFile);
      const { prompts } = await generateVariations({ direction: direction.trim() || "lifestyle photo", count: varCount, inputType, productName: productName.trim() || undefined }, token);
      const { results } = await generateImages({ referenceBase64: base64, referenceMimeType: refFile.type, prompts, aspectRatio }, token);
      setVarResults(results);
      const ok = results.filter(r => r.imageBase64).length;
      toast.success(`${ok} of ${results.length} images generated`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setVarLoading(false); }
  }

  function exportBriefs() {
    if (!briefs.length) { toast.error("Queue is empty"); return; }
    const blob = new Blob([JSON.stringify(briefs, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "content-line-batch.json";
    a.click();
    toast.success("Batch exported");
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")) { setRefFile(f); setRefPreview(URL.createObjectURL(f)); }
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", background: "oklch(0.085 0.022 272 / 0.9)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "oklch(0.72 0.2 300 / 0.15)", border: "1px solid oklch(0.72 0.2 300 / 0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Layers size={16} color="oklch(0.72 0.2 300)" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", letterSpacing: "-0.02em" }}>
            Aurora <span style={{ color: "var(--accent)" }}>Content Line</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{email}</span>
          <button onClick={() => supabase.auth.signOut()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      <main style={{ flex: 1, padding: "28px 24px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 4 }}>
          {([["scripts","Scripts","FileText"],["variations","Visual Variations","ImageIcon"]] as const).map(([id, label, icon]) => {
            const Icon = icon === "FileText" ? FileText : ImageIcon;
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", background: active ? "oklch(0.72 0.2 300 / 0.15)" : "transparent", color: active ? "var(--accent)" : "var(--text-muted)", transition: "all 0.15s" }}>
                <Icon size={14} />{label}
              </button>
            );
          })}
        </div>

        {/* ── SCRIPTS TAB ───────────────────────────────────────────────── */}
        {tab === "scripts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card label="Campaign brief">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <Label>Product / offer</Label>
                  <textarea value={product} onChange={e => setProduct(e.target.value)} rows={2} style={textareaStyle} />
                </div>
                <div>
                  <Label>Target audience</Label>
                  <textarea value={audience} onChange={e => setAudience(e.target.value)} rows={2} style={textareaStyle} />
                </div>
                <div>
                  <Label>Niche</Label>
                  <select value={niche} onChange={e => setNiche(e.target.value)} style={selectStyle}>
                    {NICHES.map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Script length</Label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {LENGTHS.map(l => (
                      <button key={l.value} onClick={() => setLength(l.value)} style={{ ...chipStyle, ...(length === l.value ? chipActiveStyle : {}) }}>{l.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Count ({count})</Label>
                  <input type="range" min={1} max={15} value={count} onChange={e => setCount(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <Label>Hook angles</Label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {ALL_ANGLES.map(a => {
                    const active = angles.has(a);
                    return (
                      <button key={a} onClick={() => setAngles(prev => { const n = new Set(prev); active ? n.delete(a) : n.add(a); return n; })} style={{ ...chipStyle, ...(active ? chipActiveStyle : {}) }}>{a}</button>
                    );
                  })}
                </div>
              </div>
              <button onClick={handleGenerateScripts} disabled={scriptsLoading} style={{ ...generateBtnStyle, marginTop: 18, opacity: scriptsLoading ? 0.6 : 1 }}>
                {scriptsLoading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Generating…</> : <><FileText size={15} /> Generate Script Arc</>}
              </button>
            </Card>

            {briefs.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{briefs.length} brief{briefs.length !== 1 ? "s" : ""} in queue</h3>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={exportBriefs} style={{ ...secondaryBtnStyle }}><Download size={13} /> Export JSON</button>
                    <button onClick={() => setBriefs([])} style={{ ...secondaryBtnStyle, color: "#ef4444" }}><X size={13} /> Clear</button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {briefs.map((brief, i) => <BriefCard key={brief.id} brief={brief} index={i} arcBg={arcBg} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── VARIATIONS TAB ────────────────────────────────────────────── */}
        {tab === "variations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card label="Visual variations">
              {/* Input type */}
              <Label>Reference type</Label>
              <div style={{ display: "flex", gap: 6, marginTop: 6, marginBottom: 14 }}>
                {(["person","product"] as const).map(t => (
                  <button key={t} onClick={() => setInputType(t)} style={{ ...chipStyle, ...(inputType === t ? chipActiveStyle : {}), textTransform: "capitalize" }}>{t}</button>
                ))}
              </div>

              {/* Reference upload */}
              <Label>Reference photo</Label>
              <div
                onDrop={onDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => { const i = document.createElement("input"); i.type="file"; i.accept="image/*"; i.onchange = () => { const f = i.files?.[0]; if (f) { setRefFile(f); setRefPreview(URL.createObjectURL(f)); }}; i.click(); }}
                style={{ marginTop: 6, marginBottom: 14, height: refPreview ? "auto" : 120, border: "2px dashed var(--border)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", position: "relative" }}
              >
                {refPreview
                  ? <img src={refPreview} alt="ref" style={{ maxHeight: 200, display: "block" }} />
                  : <div style={{ textAlign: "center", color: "var(--text-muted)" }}><Upload size={22} style={{ margin: "0 auto 8px" }} /><p style={{ fontSize: 13 }}>Drop or click to upload</p></div>
                }
                {refPreview && (
                  <button onClick={e => { e.stopPropagation(); setRefFile(null); setRefPreview(null); }} style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <X size={13} color="#fff" />
                  </button>
                )}
              </div>

              {inputType === "person" && (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 14, cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 1, accentColor: "var(--accent)" }} />
                  I confirm I have rights / consent to use this person's likeness for AI-generated images.
                </label>
              )}

              {inputType === "product" && (
                <div style={{ marginBottom: 14 }}>
                  <Label>Product name (optional)</Label>
                  <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Aura Sleep Gummies" style={inputStyle} />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <Label>Style direction</Label>
                  <textarea value={direction} onChange={e => setDirection(e.target.value)} rows={2} style={textareaStyle} />
                </div>
                <div>
                  <Label>Aspect ratio</Label>
                  <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} style={selectStyle}>
                    {["1:1","4:5","9:16","16:9","3:4"].map(r => <option key={r}>{r}</option>)}
                  </select>
                  <Label style={{ marginTop: 10 }}>Count ({varCount})</Label>
                  <input type="range" min={2} max={24} step={2} value={varCount} onChange={e => setVarCount(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)", marginTop: 4 }} />
                </div>
              </div>

              <button onClick={handleGenerateVariations} disabled={varLoading} style={{ ...generateBtnStyle, marginTop: 18, opacity: varLoading ? 0.6 : 1 }}>
                {varLoading ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Generating — this may take a minute…</> : <><ImageIcon size={15} /> Generate Visual Variations</>}
              </button>
            </Card>

            {varResults.length > 0 && (
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{varResults.filter(r => r.imageBase64).length} of {varResults.length} images ready</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                  {varResults.map((r, i) => (
                    <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                      {r.imageBase64
                        ? <>
                            <img src={`data:image/jpeg;base64,${r.imageBase64}`} alt={r.prompt} style={{ width: "100%", display: "block", aspectRatio: aspectRatio.replace(":", "/") }} />
                            <div style={{ padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>{r.prompt.slice(0, 40)}…</span>
                              <a href={`data:image/jpeg;base64,${r.imageBase64}`} download={`variation-${i+1}.jpg`} style={{ color: "var(--accent)", flexShrink: 0 }}><Download size={13} /></a>
                            </div>
                          </>
                        : <div style={{ padding: 16, color: "#ef4444", fontSize: 12 }}>Error: {r.error}</div>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );
}

function BriefCard({ brief, index, arcBg }: { brief: UgcBrief & { id: number }; index: number; arcBg: (s: string) => string }) {
  const [copied, setCopied] = useState<"script"|"json"|null>(null);
  function copy(type: "script"|"json") {
    navigator.clipboard.writeText(type === "script" ? brief.script : JSON.stringify(brief, null, 2));
    setCopied(type);
    setTimeout(() => setCopied(null), 1600);
  }
  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", minWidth: 22 }}>#{index + 1}</span>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: arcBg(brief.arc_position), border: "1px solid oklch(1 0 0 / 0.1)", color: "var(--text)" }}>{brief.arc_position.split(" ")[0]}</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{brief.angle}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <CopyBtn label="Script" copied={copied === "script"} onClick={() => copy("script")} />
          <CopyBtn label="JSON" copied={copied === "json"} onClick={() => copy("json")} />
        </div>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 6 }}>"{brief.hook}"</p>
        <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.65, marginBottom: 12, whiteSpace: "pre-wrap" }}>{brief.script}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[["Scene", brief.scene_direction], ["On-screen", brief.on_screen_text], ["CTA", brief.cta], ["Caption", brief.caption]].map(([k, v]) => (
            <div key={k} style={{ background: "oklch(1 0 0 / 0.03)", borderRadius: 8, padding: "8px 10px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k}</p>
              <p style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CopyBtn({ label, copied, onClick }: { label: string; copied: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, fontSize: 11, fontWeight: 500, background: "oklch(1 0 0 / 0.05)", border: "1px solid var(--border)", color: copied ? "var(--accent)" : "var(--text-muted)", cursor: "pointer" }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}{label}
    </button>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 14, letterSpacing: "-0.01em" }}>{label}</h2>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: 20 }}>{children}</div>
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, ...style }}>{children}</p>;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const textareaStyle: React.CSSProperties = { width: "100%", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", fontSize: 13, resize: "vertical", outline: "none", lineHeight: 1.6 };
const inputStyle: React.CSSProperties = { width: "100%", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", fontSize: 13, outline: "none", marginTop: 6 };
const selectStyle: React.CSSProperties = { width: "100%", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", fontSize: 13, outline: "none", cursor: "pointer" };
const chipStyle: React.CSSProperties = { padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", transition: "all 0.15s" };
const chipActiveStyle: React.CSSProperties = { borderColor: "var(--accent)", background: "oklch(0.72 0.2 300 / 0.12)", color: "var(--accent)" };
const generateBtnStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 20px", borderRadius: 12, fontWeight: 700, fontSize: 14, background: "var(--accent)", border: "none", color: "#fff", cursor: "pointer", boxShadow: "0 0 20px oklch(0.72 0.2 300 / 0.3)" };
const secondaryBtnStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 500, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer" };
