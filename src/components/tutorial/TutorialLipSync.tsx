import { ConceptBox, CustomizeTable, FillTemplate, Logo, NeedBox, PromptBlock, SectionHeader, Step, TipBox } from "./shared";
import { C } from "./tokens";

// ─── Section 3: Phone Lip Sync ────────────────────────────────────────────────

export function TutorialLipSync() {
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
