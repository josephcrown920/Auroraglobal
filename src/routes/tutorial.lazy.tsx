import { createLazyFileRoute } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { CoverPage } from "@/components/tutorial/shared";
import { C } from "@/components/tutorial/tokens";
import { TutorialColors } from "@/components/tutorial/TutorialColors";
import { TutorialMotion } from "@/components/tutorial/TutorialMotion";
import { TutorialLipSync } from "@/components/tutorial/TutorialLipSync";

export const Route = createLazyFileRoute("/tutorial")({
  component: TutorialPage,
});

// ─── Main page ────────────────────────────────────────────────────────────────

function TutorialPage() {
  const btnStyle: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "12px 24px", borderRadius: 10, cursor: "pointer",
    background: `linear-gradient(135deg, ${C.accent}, oklch(0.6 0.22 280))`,
    color: "#fff", fontWeight: 700, fontSize: 14, border: "none",
    fontFamily: "'Inter', system-ui, sans-serif",
    boxShadow: `0 4px 24px ${C.accentGlow}`,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @page { size: A4; margin: 15mm; }
        @media print {
          .no-print { display: none !important; }
          .page-break { break-before: page; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: oklch(0.085 0.022 272) !important; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        strong { font-weight: 700; }
        ul, ol { padding-left: 20px; }
      `}</style>

      {/* Print / download button — hidden during print */}
      <div className="no-print" style={{
        position: "fixed", top: 16, right: 16, zIndex: 1000,
        display: "flex", gap: 10, alignItems: "center",
      }}>
        <a href="/tutorial-guide.pdf" download="Aurora-Studio-Tutorial-Guide.pdf" style={{ ...btnStyle, textDecoration: "none" }}>
          ↓ Download PDF
        </a>
        <button style={{ ...btnStyle, background: C.bgElevated, boxShadow: "none", border: `1px solid ${C.border}` }} onClick={() => {
          if (typeof window !== "undefined") window.print();
        }}>
          Print
        </button>
      </div>

      <div style={{
        background: C.bg, color: C.text, minHeight: "100vh",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <CoverPage />
        <TutorialColors />
        <TutorialMotion />
        <TutorialLipSync />
      </div>
    </>
  );
}
