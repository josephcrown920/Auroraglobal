import { createLazyFileRoute } from "@tanstack/react-router";
import type { CSSProperties } from "react";

export const Route = createLazyFileRoute("/tutorial")({
  component: TutorialPage,
});

// ─── Brand tokens (hardcoded for print stability) ─────────────────────────────
const C = {
  bg:          "oklch(0.085 0.022 272)",
  bgCard:      "oklch(0.12 0.02 272)",
  bgElevated:  "oklch(0.15 0.022 272)",
  border:      "oklch(0.22 0.018 272)",
  text:        "oklch(0.97 0.004 272)",
  textMuted:   "oklch(0.6 0.01 272)",
  accent:      "oklch(0.72 0.2 300)",
  accentGlow:  "oklch(0.72 0.2 300 / 0.25)",
  accentDim:   "oklch(0.72 0.2 300 / 0.15)",
};

// ─── Shared sub-components ────────────────────────────────────────────────────

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: `linear-gradient(135deg, ${C.accent}, oklch(0.6 0.22 280))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16, color: "#fff", flexShrink: 0,
      }}>✦</div>
      <span style={{ fontWeight: 800, fontSize: 16, color: C.text, letterSpacing: "-0.02em" }}>
        Aurora Studio
      </span>
    </div>
  );
}

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      marginBottom: 28, paddingBottom: 20,
      borderBottom: `1px solid ${C.border}`,
    }}>
      <Logo />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.textMuted }}>Section {num}</span>
        <span style={{ fontWeight: 800, fontSize: 22, color: C.accent, letterSpacing: "-0.02em" }}>
          {title}
        </span>
      </div>
    </div>
  );
}

function ConceptBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderLeft: `4px solid ${C.accent}`,
      borderRadius: "0 10px 10px 0", padding: "16px 20px", marginBottom: 20,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: C.accent, marginBottom: 8 }}>
        ⚡ The Concept
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.65, color: C.text }}>{children}</div>
    </div>
  );
}

function NeedBox({ items }: { items: string[] }) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "16px 20px", marginBottom: 24,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
        textTransform: "uppercase", color: C.accent, marginBottom: 12 }}>
        ⚡ What You Need
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10,
            fontSize: 14, lineHeight: 1.6, color: C.text, marginBottom: 6 }}>
            <span style={{ color: C.accent, flexShrink: 0, marginTop: 1 }}>✦</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step({ num, title, children }: { num: number; title: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg, ${C.accent}, oklch(0.6 0.22 280))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: 13, color: "#fff", marginTop: 2,
      }}>{num}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: children ? 8 : 0 }}>
          {title}
        </div>
        {children && <div style={{ fontSize: 13.5, lineHeight: 1.65, color: C.text }}>{children}</div>}
      </div>
    </div>
  );
}

function PromptBlock({ label, prompt }: { label?: string; prompt: string }) {
  return (
    <div style={{
      background: C.bgElevated, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${C.accent}`, borderRadius: "0 8px 8px 0",
      margin: "12px 0 16px 0", overflow: "hidden",
    }}>
      {label && (
        <div style={{
          padding: "7px 16px", background: C.accentDim,
          borderBottom: `1px solid ${C.border}`,
          fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: C.accent,
        }}>
          {label}
        </div>
      )}
      <div style={{
        padding: "14px 16px", fontSize: 12.5, lineHeight: 1.75,
        color: C.text, fontFamily: "'Courier New', monospace",
        whiteSpace: "pre-wrap", wordBreak: "break-word",
      }}>
        {prompt}
      </div>
    </div>
  );
}

function TipBox({ children, variant = "tip" }: { children: React.ReactNode; variant?: "tip" | "warning" | "secret" }) {
  const icons: Record<string, string> = { tip: "💡", warning: "⚠️", secret: "🔒" };
  const labels: Record<string, string> = { tip: "Pro Tip", warning: "Important", secret: "The Secret" };
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "13px 16px", margin: "14px 0",
      fontSize: 13.5, lineHeight: 1.65, color: C.text,
    }}>
      <strong style={{ color: C.accent }}>{icons[variant]} {labels[variant]}: </strong>
      {children}
    </div>
  );
}

function CustomizeTable({ rows }: { rows: { field: string; example: string; yours: string }[] }) {
  return (
    <table style={{
      width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginTop: 12,
    }}>
      <thead>
        <tr>
          {["Customize", "Example from guide", "Replace with yours"].map((h) => (
            <th key={h} style={{
              background: C.accentDim, color: C.accent, textAlign: "left",
              padding: "9px 12px", fontWeight: 700, fontSize: 11,
              letterSpacing: "0.08em", textTransform: "uppercase",
              border: `1px solid ${C.border}`,
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? C.bgCard : C.bgElevated }}>
            <td style={{ padding: "8px 12px", border: `1px solid ${C.border}`, fontWeight: 600, color: C.textMuted, whiteSpace: "nowrap" }}>{row.field}</td>
            <td style={{ padding: "8px 12px", border: `1px solid ${C.border}`, color: C.text, fontFamily: "'Courier New', monospace", fontSize: 11.5 }}>{row.example}</td>
            <td style={{ padding: "8px 12px", border: `1px solid ${C.border}`, color: C.textMuted, fontStyle: "italic" }}>{row.yours}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FillTemplate({ label, template }: { label: string; template: string }) {
  return (
    <div style={{
      background: C.bgCard, border: `1px solid ${C.border}`,
      borderRadius: 8, overflow: "hidden", margin: "14px 0",
    }}>
      <div style={{
        padding: "7px 14px", background: C.bgElevated,
        borderBottom: `1px solid ${C.border}`,
        fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
        textTransform: "uppercase", color: C.textMuted,
      }}>
        {label}
      </div>
      <div style={{
        padding: "13px 14px", fontSize: 12, lineHeight: 1.75, color: C.text,
        fontFamily: "'Courier New', monospace", whiteSpace: "pre-wrap",
      }}>
        {template}
      </div>
    </div>
  );
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function CoverPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: C.bg, position: "relative", overflow: "hidden",
      padding: "60px 40px",
    }}>
      {/* Radial violet glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `radial-gradient(ellipse 70% 55% at 50% 42%, ${C.accentGlow}, transparent 65%)`,
      }} />

      <div style={{ position: "relative", textAlign: "center", maxWidth: 600 }}>
        {/* Logo mark */}
        <div style={{
          width: 80, height: 80, borderRadius: 22,
          background: `linear-gradient(135deg, ${C.accent}, oklch(0.6 0.22 280))`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, margin: "0 auto 24px",
          boxShadow: `0 0 60px ${C.accentGlow}`,
        }}>✦</div>

        {/* Wordmark */}
        <h1 style={{
          margin: "0 0 10px", fontSize: 48, fontWeight: 800,
          letterSpacing: "-0.04em", color: C.text, lineHeight: 1,
        }}>
          Aurora Studio
        </h1>

        {/* Subtitle */}
        <p style={{
          margin: "0 0 48px", fontSize: 20, fontWeight: 400,
          color: C.textMuted, letterSpacing: "0.02em",
        }}>
          Artist Tutorial Guide
        </p>

        {/* Section pills */}
        <div style={{
          display: "flex", gap: 10, justifyContent: "center",
          flexWrap: "wrap", marginBottom: 60,
        }}>
          {[
            { n: "01", label: "Colors Performance" },
            { n: "02", label: "Motion Control" },
            { n: "03", label: "Phone Lip Sync" },
          ].map(({ n, label }) => (
            <div key={n} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 20px", borderRadius: 100,
              border: `1px solid ${C.border}`,
              background: C.bgCard,
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: "0.1em" }}>{n}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 40, height: 1, background: C.border, margin: "0 auto 24px" }} />

        {/* URL */}
        <p style={{
          margin: 0, fontSize: 13, color: C.textMuted,
          letterSpacing: "0.06em", textTransform: "lowercase",
        }}>
          aurora.studio
        </p>
      </div>
    </div>
  );
}

// ─── Section 1: Colors Performance ───────────────────────────────────────────

function SectionColors() {
  const wideAnglePrompt = `Place the subject (man in yellow jacket) into a minimalist studio performance scene. Full-body side profile pose, arms slightly extended forward as if performing. Use the exact suspended vintage studio microphone from the reference — identical shape, size, material, cable — hanging from ceiling at chest level. Keep microphone photorealistic to reference. Environment is a seamless hot pink cyclorama studio — background and floor are one continuous hot pink color, no visible edges or corners. Soft even glossy lighting with smooth gradient. Subject stands on a circular performance platform matching the hot pink tone, slightly elevated with subtle shadow and faint reflective sheen. Preserve exact facial likeness, beard, skin tone, hairstyle, body proportions. Outfit identical: yellow jacket, black shorts, white socks, black shoes, all accessories. Cinematic studio lighting, gentle floor shadow, rim light separation, ultra-realistic skin texture, natural pores, sharp clothing detail, high-end music video aesthetic, 4K photoreal quality.`;

  const closeUpPrompt = `Place the subject (man in yellow jacket) into a studio performance scene. Medium close-up from chest up. Subject turned slightly to side but mostly facing camera — approximately 30-45° angled pose, majority of face visible (both eyes, nose bridge mostly facing camera, slight cheek contour). Use the exact suspended vintage studio microphone from reference — identical design, metallic finish, hanging cable — positioned in front at mouth level with same spacing as reference. Environment is a seamless continuous super hot pink cyclorama background filling entire frame top to bottom, no visible floor line, corners, or edges. Preserve exact facial likeness, beard, hairstyle, skin tone, proportions from yellow jacket reference. Outfit identical: yellow jacket, black shorts, accessories unchanged. Pose natural and expressive as if mid-performance, hands slightly raised or gesturing. Soft even studio lighting, gentle shadows, subtle rim light separation, ultra-realistic skin texture with natural pores, sharp clothing detail, shallow depth of field but subject fully crisp, high-end music video aesthetic, 4K photoreal quality.`;

  return (
    <div className="page-break" style={{
      background: C.bg, padding: "50px 56px",
      minHeight: "100vh", boxSizing: "border-box",
    }}>
      <SectionHeader num="01" title="Colors Performance" />

      <ConceptBox>
        A multi-angle performance video inspired by the iconic Colors Show format — bold single-color
        background, hanging vintage microphone, cinematic lighting — all generated with Aurora and
        brought to life with your own cell phone performance footage. One phone. One idea. Full video.
      </ConceptBox>

      <NeedBox items={[
        "A photo of yourself to use as the subject reference",
        "2 reference screenshots from any Colors-style performance (one wide/full-body, one medium close-up)",
        "A cell phone to record your performance",
        "Your song/audio ready to perform to",
        "An aurora.studio account",
      ]} />

      <div style={{
        fontSize: 13, fontWeight: 700, letterSpacing: "0.10em",
        textTransform: "uppercase", color: C.accent, marginBottom: 16,
      }}>
        ⚡ Step-by-Step
      </div>

      <Step num={1} title="Find Your Reference Images">
        Screenshot or save two angles from any Colors-style performance — one wide/full-body shot and
        one medium close-up. These set the composition reference for your Aurora-generated images.
      </Step>

      <Step num={2} title="Open aurora.studio → Studio → Image">
        Navigate to the Studio section. Select the <strong>Image</strong> tab. Choose the{" "}
        <strong style={{ color: C.accent }}>Aurora Identity</strong> model. Set aspect ratio to{" "}
        <strong>9:16</strong>.
      </Step>

      <Step num={3} title="Upload Reference Images">
        Upload two images: your Colors reference screenshot <strong>+</strong> a photo of yourself.
        Aurora uses both to place you into the scene with your exact likeness.
      </Step>

      <Step num={4} title="Generate — Wide Angle (Full Body)">
        Paste the prompt below and hit Generate:
        <PromptBlock label="Wide Angle Prompt" prompt={wideAnglePrompt} />
        <TipBox>
          Customize by changing "hot pink" to any color you want — red, blue, green, orange. Update the
          outfit description to match what you're actually wearing. The scene, lighting, and microphone
          logic stay the same.
        </TipBox>
      </Step>

      <Step num={5} title="Generate — Close-Up Angle">
        Same process, new angle. Upload the close-up reference + your photo, then use this prompt:
        <PromptBlock label="Close-Up Prompt" prompt={closeUpPrompt} />
      </Step>

      <Step num={6} title="Record Your Performance">
        Using your cell phone, record yourself performing your song from the exact two angles matching
        the images you generated. Match the pose and framing as closely as possible.
        <TipBox>
          You don't need a studio or fancy setup. Make sure your body angle and framing match the
          generated images — Aurora handles the rest. Perform with energy; the motion transfer picks
          up on every movement.
        </TipBox>
      </Step>

      <Step num={7} title="Animate with Motion">
        Go to <strong>aurora.studio → Motion</strong>. For each angle:
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Upload the Aurora-generated image as the source</li>
          <li>Upload your cell phone performance video as the motion reference</li>
          <li>Add a short prompt to guide the motion (e.g., <em>"man performing and singing expressively"</em>)</li>
          <li>Hit Generate and let Aurora bring the image to life</li>
        </ul>
      </Step>

      <Step num={8} title="Edit & Export">
        Once both angles are generated, combine them in any video editor (CapCut, Premiere, or the
        Aurora editor). Cut between the wide and close-up angles to match the energy of your
        performance. Add your song audio — done.
        <TipBox variant="secret">
          The magic is in matching your cell phone performance angles to the Aurora-generated images.
          The closer the match, the better the motion transfer. Take a few attempts if needed — it's
          worth it.
        </TipBox>
      </Step>

      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "18px 20px", marginTop: 8,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.accent, marginBottom: 10 }}>
          ⚡ Customize It
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.75, color: C.text }}>
          This guide uses a hot pink Colors theme, but you can make it any vibe:
        </div>
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, lineHeight: 1.9, fontSize: 13.5, color: C.text }}>
          <li><strong>Change the color:</strong> Replace "hot pink" with any color in the prompts</li>
          <li><strong>Change the outfit:</strong> Update the outfit description to match what you're wearing</li>
          <li><strong>Change the set:</strong> Swap "cyclorama studio" for outdoor scenes, concert stages, etc.</li>
          <li><strong>Add props:</strong> Add guitar, piano, DJ setup — describe them in the prompt</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Section 2: Motion Control ────────────────────────────────────────────────

function SectionMotion() {
  const baseScenePrompt = `Create a hyper-realistic composite image using the five provided reference images, using the man from the uploaded close-up selfie as the primary identity source, preserving his exact facial features, skin tone, complexion, beard texture, hairstyle, eye detail, and overall likeness with absolute accuracy, replacing the person in the microphone staging reference image with this subject while keeping the same pose, body positioning, framing, perspective, and camera angle exactly as in that reference, dressing the subject in the exact outfit from the outfit reference image consisting of the camo Supreme hoodie, olive green pants, and white Adidas sneakers with accurate colors, fabric textures, proportions, and fit, placing the subject outdoors in front of the Learning Center building from the building reference image as the main background environment, and additionally incorporating the luxury white car from the car reference image positioned behind the subject in the scene in the same relative placement, angle, scale, and visual prominence as the car shown in the microphone staging reference image, ensuring the vehicle looks naturally parked behind the subject as part of the environment, including a vintage hanging microphone suspended directly in front of the subject at mouth level staged identically to the reference image, applying true cinematic shallow depth of field so that the subject, microphone, and foreground remain in razor-sharp focus while both the Learning Center building and the car in the background are softly blurred with natural optical bokeh and realistic lens falloff rather than artificial blur, matching the visual style of imagery shot on an ARRI Alexa cinema camera with a high-quality prime lens, using filmic color science, natural highlight roll-off, accurate dynamic range, professional golden-hour outdoor lighting, and cinematic realism, while implementing advanced skin realism by enhancing all facial imperfections with high-accuracy micro-detail including authentic pores, subtle texture variation, fine lines, micro-creases, natural asymmetry, faint scars, freckles, vellus hairs, and true surface irregularities, strengthening realistic material response such as matte versus oily zones, natural specularity, and micro-shadows without introducing smoothing, softening, or plastic artifacts, correcting only elements that appear broken or AI-distorted while fully preserving the subject's identity and keeping the original color grading exactly as it is, enhancing the eyes with high-fidelity micro-detail including crisp iris texture, natural radial patterns, subtle chromatic variation, accurate subsurface light response, refined eyelids, lashes, and tear ducts with true anatomical detail and natural moisture reflections, maintaining realistic skin translucency, authentic beard stubble detail, and natural lip texture, avoiding any beauty filters or artificial perfection, and producing a final result that is ultra-photorealistic with seamless blending between subject, car, and environment, accurate proportions and perspective, true optical depth, professional cinematic quality, 4K resolution, and absolutely no text, logos, or visual artifacts.`;

  const reAnglePrompts: { label: string; prompt: string }[] = [
    { label: "Side Profile", prompt: "super close up, from the side front angle of the man, keep bokeh depth of field" },
    { label: "Wide Shot", prompt: "wide shot from behind the subject, showing full environment, keep cinematic depth of field" },
    { label: "Low Angle", prompt: "low angle looking up at the subject, dramatic perspective, keep bokeh depth of field" },
    { label: "Close-Up Face", prompt: "extreme close-up on the face, eyes looking into camera, shallow depth of field" },
    { label: "Over Shoulder", prompt: "over the shoulder shot from behind, looking at the scene ahead, cinematic bokeh" },
    { label: "Dutch Angle", prompt: "tilted dutch angle, dynamic composition, dramatic cinematic lighting" },
  ];

  const customizeRows = [
    { field: "Outfit", example: "camo Supreme hoodie, olive green pants, and white Adidas sneakers", yours: "Your outfit (e.g. black leather jacket, ripped jeans, and Jordan 4s)" },
    { field: "Location", example: "Learning Center building", yours: "Your spot (e.g. graffiti warehouse, downtown skyline, recording studio)" },
    { field: "Car / Prop", example: "luxury white car", yours: "Your flex (e.g. matte black Hellcat, vintage Cadillac, motorcycle)" },
    { field: "Pose ref", example: "microphone staging reference image", yours: "Keep as-is OR describe your pose (leaning against the car, sitting on steps)" },
    { field: "Gender", example: "the man", yours: "Change to \"the woman\" if needed" },
    { field: "Face detail", example: "beard texture", yours: "Adjust for your features — remove if no beard, add \"braids\" if applicable" },
  ];

  return (
    <div className="page-break" style={{
      background: C.bg, padding: "50px 56px",
      minHeight: "100vh", boxSizing: "border-box",
    }}>
      <SectionHeader num="02" title="Motion Control" />

      <ConceptBox>
        Record a simple performance video anywhere on your phone. Gather 5 reference images. Aurora
        builds a full AI scene — then you shoot it from multiple angles using re-angle prompts.
        Aurora Motion animates each angle with your real performance. Edit together for a
        full music video. One phone recording. Unlimited shots.
      </ConceptBox>

      <NeedBox items={[
        "Image 1 — Your Selfie: clear face shot for Aurora to match your exact features and skin tone",
        "Image 2 — Your Outfit: flat lay or photo of the clothes you want to wear",
        "Image 3 — Your Location: building, street, studio — whatever fits your vibe",
        "Image 4 — Pose Reference: a photo showing the pose, camera angle, and staging you want",
        "Image 5 — Car or Prop: a car, bike, or prop you want in the background",
      ]} />

      <div style={{
        fontSize: 13, fontWeight: 700, letterSpacing: "0.10em",
        textTransform: "uppercase", color: C.accent, marginBottom: 16,
      }}>
        ⚡ Step-by-Step
      </div>

      <Step num={1} title="Record Your Performance">
        Film yourself performing your song anywhere — your room, a parking lot, outside. Your phone
        camera is perfect. This recording is your motion reference for every angle you'll generate.
      </Step>

      <Step num={2} title="Gather Your 5 Reference Images">
        Collect: a close-up selfie, the outfit you want to wear, your chosen location, a pose/staging
        reference, and a car or prop for the background.
      </Step>

      <Step num={3} title="Open aurora.studio → Studio → Image">
        Navigate to the Studio section. Select the <strong>Image</strong> tab. Choose the{" "}
        <strong style={{ color: C.accent }}>Aurora Identity</strong> model. Upload all <strong>5</strong> reference images.
      </Step>

      <Step num={4} title="Generate Your Base Scene">
        Paste the base scene prompt below — swap the highlighted parts for your own details (see the
        Customize table at the bottom of this section):
        <PromptBlock label="Base Scene Prompt — Customize the highlighted parts, keep all technical terms" prompt={baseScenePrompt} />
        <TipBox variant="warning">
          Don't change the technical photography terms (ARRI Alexa, bokeh, skin realism, etc.) — those
          are what make the output look cinematic. Only swap the parts that describe YOUR specific
          scene: outfit, location, car, and pose.
        </TipBox>
      </Step>

      <Step num={5} title="Generate Different Camera Angles">
        Upload your base scene result as the reference image, then use these short re-angle prompts
        one at a time to create 3–5 additional shots from the same scene:
        {reAnglePrompts.map(({ label, prompt }) => (
          <PromptBlock key={label} label={label} prompt={prompt} />
        ))}
        <TipBox>
          Generate 3–5 different angles. You now have a full multi-shot music video — all from one
          scene and one phone recording.
        </TipBox>
      </Step>

      <Step num={6} title="Animate Each Angle with Motion">
        Go to <strong>aurora.studio → Motion</strong>. For each angle:
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Upload your Aurora-generated image as the Source Image</li>
          <li>Upload your original phone recording as the Control Video</li>
          <li>Choose your resolution and hit Generate</li>
        </ul>
      </Step>

      <Step num={7} title="Repeat for Every Angle">
        Do this for each angle you generated. Every shot uses the same phone recording — Aurora
        adapts the motion to each different angle automatically.
      </Step>

      <Step num={8} title="Edit Together">
        Cut all your animated angles together in CapCut, Premiere, or any editor. Add your song
        audio. You now have a full multi-shot music video created from one phone recording and
        some reference images.
      </Step>

      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "18px 20px", marginTop: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.accent, marginBottom: 12 }}>
          Customize Your Scene
        </div>
        <CustomizeTable rows={customizeRows} />
      </div>
    </div>
  );
}

// ─── Section 3: Phone Lip Sync ────────────────────────────────────────────────

function SectionLipSync() {
  const imagePrompt = `Use the first image as the exact base frame. Do not change the environment, pose, lighting, camera angle, car, or the three women in the background. Keep the man's identity, expression, and ultra-realistic skin texture the same. Add a realistic modern smartphone held horizontally directly in front of his mouth with a bright green chroma screen. Include a woman's hand and partial forearm entering from the side holding the phone, wearing a metallic watch and visible arm tattoos. Match scale, perspective, reflections, and contact shadows so the phone and hand blend naturally with the gas station lighting.`;

  const videoPrompt = `Start with the first frame as the exact base: man seated in chair at nighttime gas station, arms crossed, eyes closed, car and three women in background unchanged. Maintain identical lighting, camera angle, depth of field, and ultra-realistic skin texture. From the right side of frame, animate a woman's hand with visible tattoos and a metallic watch smoothly moving into the scene while holding a modern smartphone horizontally with a bright green screen. The hand should travel naturally toward his face and stop with the phone positioned directly in front of his mouth, matching perspective, scale, and lighting reflections. Ensure realistic motion easing, subtle wrist rotation, natural finger grip, and correct contact shadows on his beard and hoodie. No change to his body pose or expression; only the hand and phone animate into place.`;

  const simplePrompt = `put a girl holding a phone infront of his mouth`;

  const imageTemplate = `Use the first image as the exact base frame. Do not change the environment, pose, lighting, or camera angle. Keep [YOUR DESCRIPTION]'s identity, expression, and ultra-realistic skin texture the same. Add a realistic modern smartphone held [POSITION — horizontally/vertically] directly in front of [his/her] mouth with a bright green chroma screen. Include [HAND DESCRIPTION] entering from the side holding the phone. Match scale, perspective, reflections, and contact shadows so the phone and hand blend naturally with the [YOUR SCENE] lighting.`;

  const videoTemplate = `Start with the first frame as the exact base: [YOUR PERSON + POSE DESCRIPTION] at [YOUR LOCATION], background unchanged. Maintain identical lighting, camera angle, depth of field, and ultra-realistic skin texture. From the [side] of frame, animate [HAND DESCRIPTION] smoothly moving into the scene while holding a modern smartphone horizontally with a bright green screen. The hand should travel naturally toward [his/her] face and stop with the phone positioned directly in front of [his/her] mouth, matching perspective, scale, and lighting reflections. Ensure realistic motion easing, subtle wrist rotation, natural finger grip, and correct contact shadows. No change to body pose or expression; only the hand and phone animate into place.`;

  const customizeRows = [
    { field: "Person / pose", example: "man seated in chair, camo Supreme hoodie, arms crossed, eyes closed", yours: "Describe yourself — what you're wearing, your pose, your look" },
    { field: "Location", example: "nighttime gas station, classic car, three women in background", yours: "Your location — studio, rooftop, concert, street, beach, anywhere" },
    { field: "Phone holder", example: "woman's hand with tattoos and metallic watch", yours: "Anyone's hand — friend, clean hand, gloved hand, etc." },
    { field: "Phone position", example: "horizontally in front of his mouth", yours: "In front of face, angled up, from the side — experiment!" },
    { field: "Vibe / lighting", example: "gas station lighting, nighttime, cinematic", yours: "Golden hour, neon, studio lights, natural daylight, moody" },
  ];

  return (
    <div className="page-break" style={{
      background: C.bg, padding: "50px 56px",
      minHeight: "100vh", boxSizing: "border-box",
    }}>
      <SectionHeader num="03" title="Phone Lip Sync" />

      <ConceptBox>
        Film yourself performing at any location. Aurora generates a photorealistic image of you
        holding a phone showing yourself performing — placed naturally into the scene. Then Aurora
        Motion animates the hand and phone into frame. CapCut motion tracking replaces the green
        screen with your actual lip sync footage. The result looks like someone filmed you on their
        phone at an incredible location.
      </ConceptBox>

      <TipBox variant="secret">
        The green screen phone trick is key — Aurora puts a green screen on the phone in the
        generated image, giving you a compositing target for CapCut. Whatever you're wearing in
        the source video is exactly what appears in the AI output.
      </TipBox>

      <NeedBox items={[
        "Reference 1 — Your Face: a screenshot of yourself from the performance video. This locks in your exact appearance, outfit, and features for Aurora.",
        "Reference 2 — The Location: the environment you want to be placed in — gas station, rooftop, city street, concert venue, anywhere viral.",
      ]} />

      <div style={{
        fontSize: 13, fontWeight: 700, letterSpacing: "0.10em",
        textTransform: "uppercase", color: C.accent, marginBottom: 16,
      }}>
        ⚡ Step-by-Step (4 Phases)
      </div>

      {/* Phase 1 */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: C.accent, marginBottom: 12,
          padding: "6px 12px", background: C.accentDim,
          borderRadius: 6, display: "inline-block",
        }}>Phase 1 — Record Your Source Video</div>
      </div>
      <Step num={1} title="Film your performance">
        Film yourself performing/lip syncing your song at any location. Phone camera works perfectly.
        Dress for the scene — your outfit carries over to the Aurora output.
      </Step>
      <Step num={2} title="Screenshot yourself from the video">
        Take a screenshot of yourself from the video — this becomes Reference 1 (the person).
      </Step>
      <Step num={3} title="Get your location image">
        Find or photograph the environment where you want the scene set. This becomes Reference 2.
      </Step>

      {/* Phase 2 */}
      <div style={{ marginBottom: 8, marginTop: 6 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: C.accent, marginBottom: 12,
          padding: "6px 12px", background: C.accentDim,
          borderRadius: 6, display: "inline-block",
        }}>Phase 2 — Generate the AI Image (~11 Aura)</div>
      </div>
      <Step num={4} title="Open aurora.studio → Studio → Image">
        Select the <strong style={{ color: C.accent }}>Aurora Identity</strong> model. Set aspect
        ratio to <strong>1:1</strong>. Upload both reference images.
      </Step>
      <Step num={5} title="Paste the image prompt and generate">
        Use the detailed prompt for precise control, or the quick prompt for faster results:
        <PromptBlock label="Image Prompt" prompt={imagePrompt} />
        <PromptBlock label="Quick Image Prompt (Simple Version)" prompt={simplePrompt} />
        <TipBox>
          Two approaches: the detailed prompt gives you precise control over every element. The simple
          prompt lets Aurora interpret more freely. Try both — sometimes simple works just as well!
        </TipBox>
      </Step>

      {/* Phase 3 */}
      <div style={{ marginBottom: 8, marginTop: 6 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: C.accent, marginBottom: 12,
          padding: "6px 12px", background: C.accentDim,
          borderRadius: 6, display: "inline-block",
        }}>Phase 3 — Create the Lip Sync Video (~70 Aura)</div>
      </div>
      <Step num={6} title="Open aurora.studio → Motion">
        Select the <strong style={{ color: C.accent }}>Aurora Motion</strong> model. Set duration to
        <strong> 10s</strong>, aspect ratio to <strong>9:16</strong> (vertical), Audio: <strong>off</strong>.
        Upload the Aurora-generated image as the Starting Frame.
      </Step>
      <Step num={7} title="Paste the video prompt and generate">
        <PromptBlock label="Video Prompt" prompt={videoPrompt} />
        <TipBox variant="warning">
          The more specific your description, the better the result. Describe your outfit,
          accessories, pose, and the scene's lighting in detail. Aurora works best when you tell
          it exactly what to keep and what to add.
        </TipBox>
      </Step>

      {/* Phase 4 */}
      <div style={{ marginBottom: 8, marginTop: 6 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
          textTransform: "uppercase", color: C.accent, marginBottom: 12,
          padding: "6px 12px", background: C.accentDim,
          borderRadius: 6, display: "inline-block",
        }}>Phase 4 — Motion Tracking in CapCut</div>
      </div>
      <Step num={8} title="Import your generated video into CapCut">
        Use motion tracking on the phone screen to lock the lip sync to the phone. This makes it look
        like someone is actually holding a phone with you performing on screen.
      </Step>

      {/* Fill-in templates */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "18px 20px", margin: "20px 0",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.accent, marginBottom: 12 }}>
          Build Your Own Version — Fill In the Blanks
        </div>
        <FillTemplate label="Your Image Prompt Template" template={imageTemplate} />
        <FillTemplate label="Your Video Prompt Template" template={videoTemplate} />
      </div>

      {/* Customize table */}
      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "18px 20px", marginTop: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.accent, marginBottom: 12 }}>
          Customize Your Scene
        </div>
        <CustomizeTable rows={customizeRows} />
      </div>

      <div style={{
        background: C.bgCard, border: `1px solid ${C.border}`,
        borderRadius: 10, padding: "18px 20px", marginTop: 20,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.accent, marginBottom: 12 }}>
          Pro Tips
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9, fontSize: 13.5, color: C.text }}>
          <li><strong>Dress for the scene:</strong> Whatever you're wearing in the source video is what appears in the Aurora output.</li>
          <li><strong>Film at viral locations:</strong> The more interesting your location reference, the more striking the result. Gas stations, rooftops, concert backstages, exotic locations — think visually striking.</li>
          <li><strong>CapCut motion tracking:</strong> This is the finishing touch that sells the illusion. Lock your lip sync content to the phone screen. Without it, you have a great image — with it, you have a viral video.</li>
          <li><strong>Multiple scenes:</strong> Record ONE performance, then swap out different location images and generate multiple scenes. One take = unlimited viral content.</li>
        </ul>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 56, paddingTop: 24, borderTop: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Logo />
        <span style={{ fontSize: 12, color: C.textMuted }}>AI Visuals for Artists · aurora.studio</span>
      </div>
    </div>
  );
}

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
        <button style={btnStyle} onClick={() => {
          if (typeof window !== "undefined") window.print();
        }}>
          ↓ Download PDF
        </button>
      </div>

      <div style={{
        background: C.bg, color: C.text, minHeight: "100vh",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <CoverPage />
        <SectionColors />
        <SectionMotion />
        <SectionLipSync />
      </div>
    </>
  );
}
